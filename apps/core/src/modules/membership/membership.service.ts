import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import type { EntityId } from '~/shared/id/entity-id'

import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { MembershipRepository } from './membership.repository'
import type {
  MembershipPlan,
  MembershipProvider,
  MembershipRow,
} from './membership.types'
import type {
  NormalizedBillingEvent,
  VerifiedBillingEvent,
} from './providers/provider.interface'

const isLiveProviderSubscription = (row: MembershipRow): boolean => {
  if (row.provider === 'manual') return false
  if (row.status !== 'active' && row.status !== 'on_hold') return false
  return row.currentPeriodEnd.getTime() > Date.now()
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly billingWebhookEventRepository: BillingWebhookEventRepository,
  ) {}

  async getByReaderId(
    readerId: EntityId | string,
  ): Promise<MembershipRow | null> {
    return this.membershipRepository.findByReaderId(readerId)
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
          byReader.provider === event.provider &&
          byReader.providerSubscriptionId === null &&
          event.type === 'activated'
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
    readerId: EntityId | string,
    input: { plan: MembershipPlan; expiresAt: Date },
  ): Promise<MembershipRow> {
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

  async revokeManual(readerId: EntityId | string): Promise<MembershipRow> {
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
}
