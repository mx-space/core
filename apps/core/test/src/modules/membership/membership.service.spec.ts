import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import type { MembershipRepository } from '~/modules/membership/membership.repository'
import { MembershipService } from '~/modules/membership/membership.service'
import type { MembershipRow } from '~/modules/membership/membership.types'
import type { NormalizedBillingEvent } from '~/modules/membership/providers/provider.interface'

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
): NormalizedBillingEvent => ({
  eventId: 'evt_1',
  provider: 'dodo',
  type: 'activated',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  plan: 'monthly',
  currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60),
  readerId: 'reader-1',
  ...overrides,
})

const createService = () => {
  const membershipRepository = createPgRepositoryMock<MembershipRepository>()
  const billingWebhookEventRepository =
    createPgRepositoryMock<BillingWebhookEventRepository>()

  membershipRepository.findByProviderSubscriptionId.mockResolvedValue(null)
  membershipRepository.findByReaderId.mockResolvedValue(null)
  billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue(null)
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

    it('inserts the webhook event before applying state and marks it processed', async () => {
      const { service, billingWebhookEventRepository, membershipRepository } =
        createService()

      const result = await service.applyEvent(createEvent())

      expect(result).toEqual({ applied: true })
      expect(billingWebhookEventRepository.create).toHaveBeenCalledWith({
        provider: 'dodo',
        eventId: 'evt_1',
        type: 'activated',
        payload: expect.objectContaining({ eventId: 'evt_1' }),
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
})
