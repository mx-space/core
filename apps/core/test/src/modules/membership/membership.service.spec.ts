import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { AppErrorCode } from '~/common/errors'
import type { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import type { MembershipRepository } from '~/modules/membership/membership.repository'
import { MembershipService } from '~/modules/membership/membership.service'
import type { MembershipRow } from '~/modules/membership/membership.types'
import { appleAccountTokenForReader } from '~/modules/membership/providers/apple-transaction'
import type {
  NormalizedBillingEvent,
  VerifiedBillingEvent,
} from '~/modules/membership/providers/provider.interface'

const createMembership = (
  overrides: Partial<MembershipRow> = {},
): MembershipRow => ({
  id: 'membership-1' as any,
  readerId: 'reader-1' as any,
  provider: 'dodo',
  providerCustomerId: 'cus_1',
  providerSubscriptionId: 'sub_1',
  plan: 'monthly',
  status: 'active',
  currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60),
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

const createEvent = (
  overrides: Partial<NormalizedBillingEvent> = {},
): VerifiedBillingEvent => ({
  event: {
    eventId: 'evt_1',
    provider: 'dodo',
    type: 'activated',
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    plan: 'monthly',
    currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60),
    readerId: 'reader-1',
    ...overrides,
  },
  rawType: 'subscription.active',
  rawPayload: {
    type: 'subscription.active',
    timestamp: '2026-07-19T00:00:00.000Z',
    data: { subscription_id: overrides.subscriptionId ?? 'sub_1' },
  },
})

const createService = () => {
  const membershipRepository = createPgRepositoryMock<MembershipRepository>()
  const billingWebhookEventRepository =
    createPgRepositoryMock<BillingWebhookEventRepository>()

  membershipRepository.findByProviderSubscriptionId.mockResolvedValue(null)
  membershipRepository.findByReaderId.mockResolvedValue(null)
  membershipRepository.readerExists.mockResolvedValue(true)
  billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue(null)
  billingWebhookEventRepository.findLatestProcessedByProviderSubscriptionId.mockResolvedValue(
    null,
  )
  billingWebhookEventRepository.findPendingByProviderSubscriptionId.mockResolvedValue(
    [],
  )
  billingWebhookEventRepository.create.mockResolvedValue({
    id: 'event-1' as any,
    provider: 'dodo',
    eventId: 'evt_1',
    type: 'activated',
    payload: {},
    processedAt: null,
    receivedAt: now,
  })

  const service = new MembershipService(
    membershipRepository,
    billingWebhookEventRepository,
  )

  return { service, membershipRepository, billingWebhookEventRepository }
}

describe('MembershipService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('applyEvent idempotency', () => {
    it('skips processing when the insert loses the (provider, event_id) conflict race', async () => {
      const { service, billingWebhookEventRepository, membershipRepository } =
        createService()
      billingWebhookEventRepository.create.mockResolvedValue(null)

      const result = await service.applyEvent(createEvent())

      expect(result).toEqual({ applied: false })
      expect(billingWebhookEventRepository.create).toHaveBeenCalled()
      expect(billingWebhookEventRepository.markProcessed).not.toHaveBeenCalled()
      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
    })

    it('retries and applies state when the first delivery fails mid-apply and processed_at is still null', async () => {
      const { service, billingWebhookEventRepository, membershipRepository } =
        createService()

      membershipRepository.create.mockRejectedValueOnce(
        new Error('transient db error'),
      )

      await expect(service.applyEvent(createEvent())).rejects.toThrow(
        'transient db error',
      )
      expect(billingWebhookEventRepository.markProcessed).not.toHaveBeenCalled()

      billingWebhookEventRepository.create.mockResolvedValue(null)
      billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue({
        id: 'event-1' as any,
        provider: 'dodo',
        eventId: 'evt_1',
        type: 'activated',
        payload: {},
        processedAt: null,
        receivedAt: now,
      })

      const result = await service.applyEvent(createEvent())

      expect(result).toEqual({ applied: true })
      expect(membershipRepository.create).toHaveBeenCalledTimes(2)
      expect(billingWebhookEventRepository.markProcessed).toHaveBeenCalledWith(
        'event-1',
        expect.any(Date),
      )
    })

    it('skips retry when the existing event row is already processed', async () => {
      const { service, billingWebhookEventRepository, membershipRepository } =
        createService()

      billingWebhookEventRepository.create.mockResolvedValue(null)
      billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue({
        id: 'event-1' as any,
        provider: 'dodo',
        eventId: 'evt_1',
        type: 'activated',
        payload: {},
        processedAt: now,
        receivedAt: now,
      })

      const result = await service.applyEvent(createEvent())

      expect(result).toEqual({ applied: false })
      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(billingWebhookEventRepository.markProcessed).not.toHaveBeenCalled()
    })

    it('inserts the webhook event before applying state and marks it processed', async () => {
      const { service, billingWebhookEventRepository, membershipRepository } =
        createService()

      const result = await service.applyEvent(createEvent())

      expect(result).toEqual({ applied: true })
      expect(billingWebhookEventRepository.create).toHaveBeenCalledWith({
        provider: 'dodo',
        eventId: 'evt_1',
        type: 'subscription.active',
        payload: expect.objectContaining({
          type: 'subscription.active',
          timestamp: '2026-07-19T00:00:00.000Z',
        }),
      })
      expect(membershipRepository.create).toHaveBeenCalled()
      expect(billingWebhookEventRepository.markProcessed).toHaveBeenCalledWith(
        'event-1',
        expect.any(Date),
      )
    })
  })

  describe('state transitions', () => {
    it('activated creates an active membership', async () => {
      const { service, membershipRepository } = createService()

      await service.applyEvent(createEvent({ type: 'activated' }))

      expect(membershipRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ readerId: 'reader-1', status: 'active' }),
      )
    })

    it('renewed updates status to active and extends the period', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({ status: 'on_hold' })
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        existing,
      )

      const newPeriodEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)
      await service.applyEvent(
        createEvent({ type: 'renewed', currentPeriodEnd: newPeriodEnd }),
      )

      expect(membershipRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({
          status: 'active',
          currentPeriodEnd: newPeriodEnd,
        }),
      )
    })

    it('on_hold updates status to on_hold', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({ status: 'active' })
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        existing,
      )

      await service.applyEvent(createEvent({ type: 'on_hold' }))

      expect(membershipRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ status: 'on_hold' }),
      )
    })

    it('cancelled updates status to cancelled', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({ status: 'active' })
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        existing,
      )

      await service.applyEvent(createEvent({ type: 'cancelled' }))

      expect(membershipRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ status: 'cancelled' }),
      )
    })

    it('plan_changed only updates the plan column', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({ status: 'active', plan: 'monthly' })
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        existing,
      )

      await service.applyEvent(
        createEvent({ type: 'plan_changed', plan: 'yearly' }),
      )

      expect(membershipRepository.update).toHaveBeenCalledWith(existing.id, {
        plan: 'yearly',
      })
    })

    it('plan_changed is a no-op when no membership exists', async () => {
      const { service, membershipRepository } = createService()

      await service.applyEvent(
        createEvent({ type: 'plan_changed', plan: 'yearly' }),
      )

      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(membershipRepository.create).not.toHaveBeenCalled()
    })

    it.each([
      {
        name: 'a replacement provider subscription',
        membership: createMembership({
          providerSubscriptionId: 'sub_current',
          status: 'active',
        }),
      },
      {
        name: 'a manual grant',
        membership: createMembership({
          provider: 'manual',
          providerCustomerId: null,
          providerSubscriptionId: null,
        }),
      },
    ])(
      'rejects a stale cancellation when the reader now has $name',
      async ({ membership }) => {
        const { service, membershipRepository } = createService()
        membershipRepository.findByReaderId.mockResolvedValue(membership)

        const result = await service.applyEvent(
          createEvent({
            eventId: 'evt_old_cancel',
            type: 'cancelled',
            subscriptionId: 'sub_old',
          }),
        )

        expect(result).toEqual({ applied: false })
        expect(membershipRepository.update).not.toHaveBeenCalled()
        expect(membershipRepository.create).not.toHaveBeenCalled()
      },
    )

    it('binds an activation to the provider row prepared for a replacement checkout', async () => {
      const { service, membershipRepository } = createService()
      const prepared = createMembership({
        providerSubscriptionId: null,
        status: 'expired',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      })
      membershipRepository.findByReaderId.mockResolvedValue(prepared)

      const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const result = await service.applyEvent(
        createEvent({
          subscriptionId: 'sub_replacement',
          currentPeriodEnd: newPeriodEnd,
        }),
      )

      expect(result).toEqual({ applied: true })
      expect(membershipRepository.update).toHaveBeenCalledWith(
        prepared.id,
        expect.objectContaining({
          providerSubscriptionId: 'sub_replacement',
          status: 'active',
          currentPeriodEnd: newPeriodEnd,
        }),
      )
    })
  })

  describe('manual grant', () => {
    let service: MembershipService
    let membershipRepository: ReturnType<
      typeof createPgRepositoryMock<MembershipRepository>
    >

    beforeEach(() => {
      const created = createService()
      service = created.service
      membershipRepository = created.membershipRepository
    })

    it('grants a manual membership when no existing row exists', async () => {
      membershipRepository.findByReaderId.mockResolvedValue(null)
      membershipRepository.create.mockResolvedValue(
        createMembership({ provider: 'manual' }),
      )

      const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24)
      await service.grantManual('reader-1', { plan: 'monthly', expiresAt })

      expect(membershipRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          readerId: 'reader-1',
          provider: 'manual',
          status: 'active',
          currentPeriodEnd: expiresAt,
        }),
      )
    })

    it('extends an existing manual grant', async () => {
      const existing = createMembership({
        provider: 'manual',
        status: 'cancelled',
      })
      membershipRepository.findByReaderId.mockResolvedValue(existing)
      membershipRepository.update.mockResolvedValue(existing)

      const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24)
      await service.grantManual('reader-1', { plan: 'yearly', expiresAt })

      expect(membershipRepository.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({
          provider: 'manual',
          status: 'active',
          currentPeriodEnd: expiresAt,
        }),
      )
    })

    it('rejects when a live provider-managed subscription exists (active)', async () => {
      const existing = createMembership({ provider: 'dodo', status: 'active' })
      membershipRepository.findByReaderId.mockResolvedValue(existing)

      await expect(
        service.grantManual('reader-1', {
          plan: 'monthly',
          expiresAt: new Date(now.getTime() + 1000),
        }),
      ).rejects.toThrow()

      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(membershipRepository.create).not.toHaveBeenCalled()
    })

    it('rejects when a live provider-managed subscription exists (on_hold in grace)', async () => {
      const existing = createMembership({
        provider: 'dodo',
        status: 'on_hold',
        currentPeriodEnd: new Date(now.getTime() + 1000 * 60),
      })
      membershipRepository.findByReaderId.mockResolvedValue(existing)

      await expect(
        service.grantManual('reader-1', {
          plan: 'monthly',
          expiresAt: new Date(now.getTime() + 1000),
        }),
      ).rejects.toThrow()
    })

    it('allows granting when an active provider subscription is past its period end', async () => {
      const existing = createMembership({
        provider: 'dodo',
        status: 'active',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      })
      membershipRepository.findByReaderId.mockResolvedValue(existing)
      membershipRepository.update.mockResolvedValue(existing)

      await service.grantManual('reader-1', {
        plan: 'monthly',
        expiresAt: new Date(now.getTime() + 1000),
      })

      expect(membershipRepository.update).toHaveBeenCalled()
    })

    it('allows granting when the provider subscription has expired', async () => {
      const existing = createMembership({
        provider: 'dodo',
        status: 'on_hold',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      })
      membershipRepository.findByReaderId.mockResolvedValue(existing)
      membershipRepository.update.mockResolvedValue(existing)

      await service.grantManual('reader-1', {
        plan: 'monthly',
        expiresAt: new Date(now.getTime() + 1000),
      })

      expect(membershipRepository.update).toHaveBeenCalled()
    })
  })

  describe('manual revoke', () => {
    it('revokes a manual grant', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({
        provider: 'manual',
        status: 'active',
      })
      membershipRepository.findByReaderId.mockResolvedValue(existing)
      membershipRepository.update.mockResolvedValue(existing)

      await service.revokeManual('reader-1')

      expect(membershipRepository.update).toHaveBeenCalledWith(existing.id, {
        status: 'cancelled',
      })
    })

    it('rejects revoking a provider-managed subscription', async () => {
      const { service, membershipRepository } = createService()
      const existing = createMembership({ provider: 'dodo', status: 'active' })
      membershipRepository.findByReaderId.mockResolvedValue(existing)

      await expect(service.revokeManual('reader-1')).rejects.toThrow()
      expect(membershipRepository.update).not.toHaveBeenCalled()
    })

    it('rejects revoking when no membership exists', async () => {
      const { service, membershipRepository } = createService()
      membershipRepository.findByReaderId.mockResolvedValue(null)

      await expect(service.revokeManual('reader-1')).rejects.toThrow()
      expect(membershipRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('confirmAppleTransaction', () => {
    const decoded = {
      appAccountToken: appleAccountTokenForReader('reader-1'),
      expiresDate: now.getTime() + 86_400_000,
      originalTransactionId: 'orig-apple',
      productId: 'yohaku.membership.monthly',
      signedDate: now.getTime(),
      transactionId: 'txn-apple',
    }
    const products = {
      monthlyProductId: 'yohaku.membership.monthly',
      yearlyProductId: 'yohaku.membership.yearly',
    }

    it('creates an apple membership for a new reader', async () => {
      const { service, membershipRepository } = createService()
      const created = createMembership({
        provider: 'apple',
        providerSubscriptionId: 'orig-apple',
        readerId: 'reader-1',
      })
      membershipRepository.create.mockResolvedValue(created)
      membershipRepository.findByReaderId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created)

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(membershipRepository.create).toHaveBeenCalled()
      expect(result).toMatchObject({
        status: 'active',
        plan: 'monthly',
        provider: 'apple',
      })
    })

    it('returns the existing live Dodo membership without rewriting it', async () => {
      const { service, membershipRepository } = createService()
      const live = createMembership({ provider: 'dodo' })
      membershipRepository.findByReaderId.mockResolvedValue(live)

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(result).toMatchObject({ provider: 'dodo', status: 'active' })
    })

    it('returns an existing active manual membership without rewriting it', async () => {
      const { service, membershipRepository } = createService()
      const live = createMembership({
        provider: 'manual',
        providerCustomerId: null,
        providerSubscriptionId: null,
      })
      membershipRepository.findByReaderId.mockResolvedValue(live)

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(result).toMatchObject({ provider: 'manual', status: 'active' })
    })

    it('rebinds an inactive non-Apple row to the confirmed Apple subscription', async () => {
      const { service, membershipRepository } = createService()
      const inactive = createMembership({
        provider: 'dodo',
        status: 'cancelled',
        currentPeriodEnd: new Date(now.getTime() - 1_000),
      })
      const rebound = createMembership({
        provider: 'apple',
        providerCustomerId: 'orig-apple',
        providerSubscriptionId: 'orig-apple',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(decoded.expiresDate),
      })
      membershipRepository.findByReaderId
        .mockResolvedValueOnce(inactive)
        .mockResolvedValueOnce(inactive)
        .mockResolvedValueOnce(rebound)

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(membershipRepository.update).toHaveBeenCalledWith(
        inactive.id,
        expect.objectContaining({
          plan: 'monthly',
          provider: 'apple',
          providerSubscriptionId: 'orig-apple',
          status: 'active',
        }),
      )
      expect(result).toMatchObject({ provider: 'apple', status: 'active' })
    })

    it('does not reactivate a cancelled Apple membership when confirmation is replayed', async () => {
      const { service, membershipRepository, billingWebhookEventRepository } =
        createService()
      const cancelled = createMembership({
        provider: 'apple',
        providerCustomerId: 'orig-apple',
        providerSubscriptionId: 'orig-apple',
        status: 'cancelled',
      })
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        cancelled,
      )
      membershipRepository.findByReaderId.mockResolvedValue(cancelled)
      billingWebhookEventRepository.create.mockResolvedValue(null)
      billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue({
        id: 'event-apple' as any,
        provider: 'apple',
        eventId: decoded.transactionId,
        type: 'apple.confirm',
        payload: decoded,
        processedAt: now,
        receivedAt: now,
      })

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(result).toMatchObject({ provider: 'apple', status: 'cancelled' })
    })

    it('rejects when the originalTransactionId is bound to another reader', async () => {
      const { service, membershipRepository } = createService()
      membershipRepository.findByProviderSubscriptionId.mockResolvedValue(
        createMembership({ readerId: 'other-reader', provider: 'apple' }),
      )

      await expect(
        service.confirmAppleTransaction({
          decoded,
          readerId: 'reader-1',
          ...products,
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_APPLE_ALREADY_BOUND,
      })
    })

    it('rejects an unknown product id', async () => {
      const { service } = createService()
      await expect(
        service.confirmAppleTransaction({
          decoded: { ...decoded, productId: 'unknown.sku' },
          readerId: 'reader-1',
          ...products,
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      })
    })

    it('rejects a transaction purchased for another reader account', async () => {
      const { service, membershipRepository, billingWebhookEventRepository } =
        createService()

      await expect(
        service.confirmAppleTransaction({
          decoded: {
            ...decoded,
            appAccountToken: appleAccountTokenForReader('reader-2'),
          },
          readerId: 'reader-1',
          ...products,
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      })

      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(billingWebhookEventRepository.create).not.toHaveBeenCalled()
    })

    it('rejects a transaction without an account token', async () => {
      const { service, membershipRepository } = createService()

      await expect(
        service.confirmAppleTransaction({
          decoded: { ...decoded, appAccountToken: undefined },
          readerId: 'reader-1',
          ...products,
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      })

      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
    })

    it('rejects a revoked Apple transaction before granting membership', async () => {
      const { service, membershipRepository, billingWebhookEventRepository } =
        createService()

      await expect(
        service.confirmAppleTransaction({
          decoded: { ...decoded, revocationDate: now.getTime() },
          readerId: 'reader-1',
          ...products,
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      })

      expect(membershipRepository.create).not.toHaveBeenCalled()
      expect(membershipRepository.update).not.toHaveBeenCalled()
      expect(billingWebhookEventRepository.create).not.toHaveBeenCalled()
    })

    it('replays a newer deferred refund before returning confirmed status', async () => {
      const { service, membershipRepository, billingWebhookEventRepository } =
        createService()
      const active = createMembership({
        provider: 'apple',
        providerCustomerId: decoded.appAccountToken,
        providerSubscriptionId: decoded.originalTransactionId,
        status: 'active',
      })
      const cancelled = createMembership({
        ...active,
        status: 'cancelled',
      })
      const refundOccurredAt = new Date(decoded.signedDate + 1_000)
      const refund = createEvent({
        customerId: decoded.appAccountToken,
        eventId: 'refund-before-confirm',
        provider: 'apple',
        readerId: '',
        subscriptionId: decoded.originalTransactionId,
        type: 'cancelled',
        occurredAt: refundOccurredAt,
      })
      const pendingRefund = {
        id: 'pending-refund' as any,
        provider: 'apple',
        eventId: refund.event.eventId,
        type: 'REFUND',
        payload: {
          _normalizedMembershipEvent: {
            ...refund.event,
            currentPeriodEnd: refund.event.currentPeriodEnd.toISOString(),
            occurredAt: refundOccurredAt.toISOString(),
          },
        },
        processedAt: null,
        receivedAt: refundOccurredAt,
      }

      await service.deferEvent(refund)
      billingWebhookEventRepository.findPendingByProviderSubscriptionId.mockResolvedValue(
        [pendingRefund],
      )
      membershipRepository.findByProviderSubscriptionId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(active)
      membershipRepository.findByReaderId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(cancelled)
      membershipRepository.create.mockResolvedValue(active)
      membershipRepository.update.mockResolvedValue(cancelled)

      const result = await service.confirmAppleTransaction({
        decoded,
        readerId: 'reader-1',
        ...products,
      })

      expect(billingWebhookEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'refund-before-confirm',
          payload: expect.objectContaining({
            _normalizedMembershipEvent: expect.objectContaining({
              occurredAt: refundOccurredAt.toISOString(),
              subscriptionId: decoded.originalTransactionId,
              type: 'cancelled',
            }),
          }),
        }),
      )
      expect(membershipRepository.update).toHaveBeenCalledWith(
        active.id,
        expect.objectContaining({ status: 'cancelled' }),
      )
      expect(result).toMatchObject({ provider: 'apple', status: 'cancelled' })
    })
  })

  it('does not apply an Apple renewal older than the latest processed refund', async () => {
    const { service, membershipRepository, billingWebhookEventRepository } =
      createService()
    const refundOccurredAt = new Date(now.getTime() - 1_000)
    billingWebhookEventRepository.findLatestProcessedByProviderSubscriptionId.mockResolvedValue(
      {
        id: 'latest-refund' as any,
        provider: 'apple',
        eventId: 'refund-latest',
        type: 'REFUND',
        payload: {
          _normalizedMembershipEvent: {
            eventId: 'refund-latest',
            provider: 'apple',
            type: 'cancelled',
            customerId: 'customer-apple',
            subscriptionId: 'subscription-apple',
            currentPeriodEnd: now.toISOString(),
            readerId: 'reader-1',
            occurredAt: refundOccurredAt.toISOString(),
          },
        },
        processedAt: refundOccurredAt,
        receivedAt: refundOccurredAt,
      },
    )

    const result = await service.applyEvent(
      createEvent({
        eventId: 'renewal-delayed',
        provider: 'apple',
        type: 'renewed',
        customerId: 'customer-apple',
        subscriptionId: 'subscription-apple',
        occurredAt: new Date(refundOccurredAt.getTime() - 1_000),
      }),
    )

    expect(result).toEqual({ applied: false })
    expect(membershipRepository.create).not.toHaveBeenCalled()
    expect(membershipRepository.update).not.toHaveBeenCalled()
    expect(billingWebhookEventRepository.markProcessed).toHaveBeenCalled()
  })
})
