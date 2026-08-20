import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { MembershipRepository } from './membership.repository'
import {
  effectiveMembershipStatus,
  type MembershipPlan,
  type MembershipProvider,
  type MembershipRow,
  type MembershipStatus,
} from './membership.types'
import {
  appleActivatedEvent,
  type AppleDecodedTransaction,
  planFromAppleProductId,
} from './providers/apple-transaction'
import type {
  NormalizedBillingEvent,
  VerifiedBillingEvent,
} from './providers/provider.interface'

const isLiveProviderSubscription = (row: MembershipRow): boolean => {
  if (row.provider === 'manual') return false
  if (row.status !== 'active' && row.status !== 'on_hold') return false
  return row.currentPeriodEnd.getTime() > Date.now()
}

const hasCurrentEntitlement = (row: MembershipRow): boolean => {
  const status = effectiveMembershipStatus(row)
  return status === 'active' || status === 'on_hold'
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly billingWebhookEventRepository: BillingWebhookEventRepository,
  ) {}

  async getByReaderId(readerId: string): Promise<MembershipRow | null> {
    return this.membershipRepository.findByReaderId(readerId)
  }

  async getByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<MembershipRow | null> {
    return this.membershipRepository.findByProviderSubscriptionId(
      providerSubscriptionId,
    )
  }

  async confirmAppleTransaction(input: {
    decoded: AppleDecodedTransaction
    monthlyProductId: string
    readerId: string
    yearlyProductId: string
  }): Promise<
    | { status: 'none' }
    | {
        currentPeriodEnd: Date
        plan: MembershipPlan
        provider: MembershipProvider
        status: MembershipStatus
      }
  > {
    const plan = planFromAppleProductId(input.decoded.productId, {
      monthlyProductId: input.monthlyProductId,
      yearlyProductId: input.yearlyProductId,
    })
    if (!plan) {
      throw createAppException(
        AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      )
    }

    const bySub = await this.membershipRepository.findByProviderSubscriptionId(
      input.decoded.originalTransactionId,
    )
    if (bySub && bySub.readerId !== input.readerId) {
      throw createAppException(AppErrorCode.MEMBERSHIP_APPLE_ALREADY_BOUND)
    }

    const byReader = await this.membershipRepository.findByReaderId(
      input.readerId,
    )
    if (
      byReader &&
      hasCurrentEntitlement(byReader) &&
      byReader.provider !== 'apple'
    ) {
      return this.toStatusResult(byReader)
    }

    const event = appleActivatedEvent(input.decoded, input.readerId, plan)
    await this.applyEvent({
      event,
      rawPayload: input.decoded,
      rawType: 'apple.confirm',
    })

    return this.toStatusResult(
      await this.membershipRepository.findByReaderId(input.readerId),
    )
  }

  async listMembers(page: number, size: number) {
    return this.membershipRepository.listMembers(page, size)
  }

  async applyEvent(
    verifiedEvent: VerifiedBillingEvent,
  ): Promise<{ applied: boolean }> {
    const { event, rawPayload, rawType } = verifiedEvent
    const webhookEventRow = await this.billingWebhookEventRepository.create({
      provider: event.provider,
      eventId: event.eventId,
      type: rawType,
      payload: rawPayload,
    })

    if (!webhookEventRow) {
      const existingRow =
        await this.billingWebhookEventRepository.findByProviderAndEventId(
          event.provider,
          event.eventId,
        )
      if (!existingRow || existingRow.processedAt) return { applied: false }

      const applied = await this.applyMembershipState(event)
      await this.billingWebhookEventRepository.markProcessed(
        existingRow.id,
        new Date(),
      )
      return { applied }
    }

    const applied = await this.applyMembershipState(event)
    await this.billingWebhookEventRepository.markProcessed(
      webhookEventRow.id,
      new Date(),
    )

    return { applied }
  }

  private async applyMembershipState(
    event: NormalizedBillingEvent,
  ): Promise<boolean> {
    let existing = await this.membershipRepository.findByProviderSubscriptionId(
      event.subscriptionId,
    )

    if (!existing) {
      const byReader = await this.membershipRepository.findByReaderId(
        event.readerId,
      )
      if (byReader) {
        const canBindInitialSubscription =
          event.type === 'activated' &&
          ((byReader.provider === event.provider &&
            byReader.providerSubscriptionId === null) ||
            !hasCurrentEntitlement(byReader))
        if (!canBindInitialSubscription) return false
        existing = byReader
      }
    }

    if (event.type === 'plan_changed') {
      if (existing && event.plan) {
        await this.membershipRepository.update(existing.id, {
          plan: event.plan,
        })
      }
      return true
    }

    const status =
      event.type === 'cancelled'
        ? 'cancelled'
        : event.type === 'on_hold'
          ? 'on_hold'
          : 'active'

    if (existing) {
      await this.membershipRepository.update(existing.id, {
        provider: event.provider as MembershipRow['provider'],
        providerCustomerId: event.customerId,
        providerSubscriptionId: event.subscriptionId,
        plan: event.plan ?? existing.plan,
        status,
        currentPeriodEnd: event.currentPeriodEnd,
      })
      return true
    }

    await this.membershipRepository.create({
      readerId: event.readerId,
      provider: event.provider as MembershipRow['provider'],
      providerCustomerId: event.customerId,
      providerSubscriptionId: event.subscriptionId,
      plan: event.plan ?? 'monthly',
      status,
      currentPeriodEnd: event.currentPeriodEnd,
    })
    return true
  }

  async prepareForCheckout(
    membership: MembershipRow,
    provider: MembershipProvider,
  ): Promise<void> {
    if (isLiveProviderSubscription(membership)) return

    await this.membershipRepository.update(membership.id, {
      provider,
      providerCustomerId: null,
      providerSubscriptionId: null,
      status: 'expired',
    })
  }

  async grantManual(
    readerId: string,
    input: { plan: MembershipPlan; expiresAt: Date },
  ): Promise<MembershipRow> {
    await this.assertReaderExists(readerId)

    const existing = await this.membershipRepository.findByReaderId(readerId)
    if (existing && isLiveProviderSubscription(existing)) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message:
          'Reader has a live provider-managed subscription; manage it in the provider portal',
      })
    }

    if (existing) {
      const updated = await this.membershipRepository.update(existing.id, {
        provider: 'manual',
        providerCustomerId: null,
        providerSubscriptionId: null,
        plan: input.plan,
        status: 'active',
        currentPeriodEnd: input.expiresAt,
      })
      return updated!
    }

    return this.membershipRepository.create({
      readerId,
      provider: 'manual',
      plan: input.plan,
      status: 'active',
      currentPeriodEnd: input.expiresAt,
    })
  }

  async revokeManual(readerId: string): Promise<MembershipRow> {
    await this.assertReaderExists(readerId)

    const existing = await this.membershipRepository.findByReaderId(readerId)
    if (!existing || existing.provider !== 'manual') {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'No manual grant found for this reader',
      })
    }

    const updated = await this.membershipRepository.update(existing.id, {
      status: 'cancelled',
    })
    return updated!
  }

  private toStatusResult(row: MembershipRow | null):
    | { status: 'none' }
    | {
        currentPeriodEnd: Date
        plan: MembershipPlan
        provider: MembershipProvider
        status: MembershipStatus
      } {
    if (!row) return { status: 'none' }
    return {
      currentPeriodEnd: row.currentPeriodEnd,
      plan: row.plan,
      provider: row.provider,
      status: effectiveMembershipStatus(row),
    }
  }

  private async assertReaderExists(readerId: string): Promise<void> {
    const exists = await this.membershipRepository.readerExists(readerId)
    if (!exists) {
      throw createAppException(AppErrorCode.READER_NOT_FOUND, { id: readerId })
    }
  }
}
