import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import type { MembershipRepository } from '~/modules/membership/membership.repository'
import type { MembershipRow } from '~/modules/membership/membership.types'

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

const createService = (
  membershipConfig: Record<string, unknown> = {
    enabled: true,
    provider: 'dodo',
    monthlyProductId: 'prod_monthly',
    yearlyProductId: 'prod_yearly',
    dodoApiKey: 'api-key',
    dodoWebhookKey: 'webhook-key',
  },
) => {
  const membershipRepository = createPgRepositoryMock<MembershipRepository>()
  const configsService = {
    get: vi.fn().mockResolvedValue(membershipConfig),
  }
  const service = new EntitlementService(
    membershipRepository,
    configsService as any,
  )
  return { service, membershipRepository, configsService }
}

describe('EntitlementService.isActiveMember', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false when the reader has no membership row', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(null)

    expect(await service.isActiveMember('reader-1')).toBe(false)
  })

  it('returns true for an active membership within the period', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(
      createMembership({ status: 'active' }),
    )

    expect(await service.isActiveMember('reader-1')).toBe(true)
  })

  it('returns true for an on_hold membership still within its grace period', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(
      createMembership({
        status: 'on_hold',
        currentPeriodEnd: new Date(now.getTime() + 1000 * 60),
      }),
    )

    expect(await service.isActiveMember('reader-1')).toBe(true)
  })

  it('returns false for a cancelled membership', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(
      createMembership({ status: 'cancelled' }),
    )

    expect(await service.isActiveMember('reader-1')).toBe(false)
  })

  it('returns false when the period has expired, even if status is active', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(
      createMembership({
        status: 'active',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      }),
    )

    expect(await service.isActiveMember('reader-1')).toBe(false)
  })

  it('returns false when on_hold and the grace period has expired', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(
      createMembership({
        status: 'on_hold',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      }),
    )

    expect(await service.isActiveMember('reader-1')).toBe(false)
  })
})

describe('EntitlementService.getActiveMemberIds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns only reader ids with a live membership', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderIds.mockResolvedValue([
      createMembership({ readerId: 'r-active' as any, status: 'active' }),
      createMembership({
        readerId: 'r-expired' as any,
        status: 'active',
        currentPeriodEnd: new Date(now.getTime() - 1000),
      }),
      createMembership({ readerId: 'r-cancelled' as any, status: 'cancelled' }),
    ])

    const result = await service.getActiveMemberIds([
      'r-active',
      'r-expired',
      'r-cancelled',
      'r-none',
    ])

    expect([...result]).toEqual(['r-active'])
  })

  it('returns an empty set for no ids without hitting the repository', async () => {
    const { service, membershipRepository } = createService()
    const result = await service.getActiveMemberIds([])
    expect(result.size).toBe(0)
    expect(membershipRepository.findByReaderIds).not.toHaveBeenCalled()
  })
})

describe('EntitlementService.getAvailability', () => {
  it('reports enabled with both plans when fully configured', async () => {
    const { service } = createService()
    expect(await service.getAvailability()).toEqual({
      enabled: true,
      plans: ['monthly', 'yearly'],
    })
    expect(await service.isMembershipPurchasable()).toBe(true)
  })

  it('reports only configured plans', async () => {
    const { service } = createService({
      enabled: true,
      provider: 'dodo',
      monthlyProductId: 'prod_monthly',
      dodoApiKey: 'api-key',
      dodoWebhookKey: 'webhook-key',
    })
    expect(await service.getAvailability()).toEqual({
      enabled: true,
      plans: ['monthly'],
    })
  })

  it('is not purchasable when disabled', async () => {
    const { service } = createService({
      enabled: false,
      provider: 'dodo',
      monthlyProductId: 'prod_monthly',
      dodoApiKey: 'api-key',
      dodoWebhookKey: 'webhook-key',
    })
    expect(await service.getAvailability()).toEqual({
      enabled: false,
      plans: [],
    })
    expect(await service.isMembershipPurchasable()).toBe(false)
  })

  it('is not purchasable when no product id is set', async () => {
    const { service } = createService({ enabled: true, provider: 'dodo' })
    expect(await service.isMembershipPurchasable()).toBe(false)
  })

  it('is not purchasable when provider is missing', async () => {
    const { service } = createService({
      enabled: true,
      monthlyProductId: 'prod_monthly',
    })
    expect(await service.isMembershipPurchasable()).toBe(false)
  })
})
