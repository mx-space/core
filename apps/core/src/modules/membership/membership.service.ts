import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import type { EntityId } from '~/shared/id/entity-id'

import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { MembershipRepository } from './membership.repository'
import type { MembershipPlan, MembershipRow } from './membership.types'
import type { NormalizedBillingEvent } from './providers/provider.interface'

const isLiveProviderSubscription = (row: MembershipRow): boolean => {
  if (row.provider === 'manual') return false
  if (row.status === 'active') return true
  return row.status === 'on_hold' && row.currentPeriodEnd.getTime() > Date.now()
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

  async applyEvent(
    event: NormalizedBillingEvent,
  ): Promise<{ applied: boolean }> {
    const webhookEventRow = await this.billingWebhookEventRepository.create({
      provider: event.provider,
      eventId: event.eventId,
      type: event.type,
      payload: event,
    })
    if (!webhookEventRow) return { applied: false }

    await this.applyMembershipState(event)
    await this.billingWebhookEventRepository.markProcessed(
      webhookEventRow.id,
      new Date(),
    )

    return { applied: true }
  }

  private async applyMembershipState(
    event: NormalizedBillingEvent,
  ): Promise<void> {
    const existing =
      (await this.membershipRepository.findByProviderSubscriptionId(
        event.subscriptionId,
      )) ?? (await this.membershipRepository.findByReaderId(event.readerId))

    if (event.type === 'plan_changed') {
      if (existing && event.plan) {
        await this.membershipRepository.update(existing.id, {
          plan: event.plan,
        })
      }
      return
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
      return
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
