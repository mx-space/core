import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { ArticlePurchaseRepository } from '~/modules/membership/article-purchase.repository'
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
    apiKey: 'api-key',
    webhookSigningKey: 'webhook-key',
  },
) => {
  const membershipRepository = createPgRepositoryMock<MembershipRepository>()
  const articlePurchaseRepository =
    createPgRepositoryMock<ArticlePurchaseRepository>()
  articlePurchaseRepository.findPaidPostIds.mockResolvedValue(new Set())
  const configsService = {
    get: vi.fn().mockResolvedValue(membershipConfig),
  }
  const service = new EntitlementService(
    membershipRepository,
    configsService as any,
    articlePurchaseRepository,
  )
  return {
    service,
    membershipRepository,
    articlePurchaseRepository,
    configsService,
  }
}

const premiumPost = (meta: unknown = null, isPublished = true) => ({
  id: 'post-1',
  isPremium: true,
  isPublished,
  meta,
})

const disabledConfig = { enabled: false, provider: 'dodo' }

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
      apiKey: 'api-key',
      webhookSigningKey: 'webhook-key',
    })
    expect(await service.getAvailability()).toEqual({
      enabled: true,
      plans: ['monthly'],
    })
  })

  it('locks premium content when Apple IAP is the only purchase path', async () => {
    const { service, membershipRepository } = createService({
      enabled: true,
      appleAppAppleId: '1234567890',
      appleBundleId: 'dev.yohaku.app',
      appleIssuerId: 'ISSUER',
      appleKeyId: 'KEYID',
      appleMonthlyProductId: 'yohaku.membership.monthly',
      applePrivateKey:
        '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----',
      appleYearlyProductId: 'yohaku.membership.yearly',
    })
    membershipRepository.findByReaderId.mockResolvedValue(null)

    expect(await service.isMembershipPurchasable()).toBe(true)
    expect(
      await service.isPremiumLocked({
        isOwner: false,
        post: premiumPost(),
        readerId: 'reader-1',
      }),
    ).toBe(true)
  })

  it('is not purchasable when disabled', async () => {
    const { service } = createService({
      enabled: false,
      provider: 'dodo',
      monthlyProductId: 'prod_monthly',
      apiKey: 'api-key',
      webhookSigningKey: 'webhook-key',
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

describe('EntitlementService.resolvePostEntitlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const resolve = (
    service: EntitlementService,
    post: ReturnType<typeof premiumPost> | { id: string; isPremium: boolean },
    ctx: { isOwner?: boolean; readerId?: string } = {},
  ) =>
    service.resolvePostEntitlement({
      post,
      isOwner: ctx.isOwner ?? false,
      readerId: ctx.readerId,
    })

  it('is public for non-premium posts', async () => {
    const { service } = createService()
    expect(await resolve(service, { id: 'p', isPremium: false })).toEqual({
      reason: 'public',
      locked: false,
    })
  })

  it('is owner for the owner', async () => {
    const { service } = createService()
    expect(
      (await resolve(service, premiumPost(), { isOwner: true })).reason,
    ).toBe('owner')
  })

  it('is free-window while now < freeUntil', async () => {
    const { service, configsService } = createService()
    const meta = {
      paywall: { freeUntil: new Date(now.getTime() + 1000).toISOString() },
    }
    expect((await resolve(service, premiumPost(meta))).reason).toBe(
      'free-window',
    )
    expect(configsService.get).not.toHaveBeenCalled()
  })

  it('treats now === freeUntil as expired', async () => {
    const { service } = createService()
    const meta = { paywall: { freeUntil: now.toISOString() } }
    expect((await resolve(service, premiumPost(meta))).reason).toBe('locked')
  })

  it('ignores the free window on unpublished posts', async () => {
    const { service } = createService()
    const meta = {
      paywall: { freeUntil: new Date(now.getTime() + 1000).toISOString() },
    }
    expect((await resolve(service, premiumPost(meta, false))).reason).toBe(
      'locked',
    )
  })

  it('is public when no purchase channel is configured', async () => {
    const { service, articlePurchaseRepository } = createService(disabledConfig)
    expect((await resolve(service, premiumPost())).reason).toBe('public')
    expect(articlePurchaseRepository.findPaidPostIds).not.toHaveBeenCalled()
  })

  it('is purchase when the reader paid for the article', async () => {
    const { service, articlePurchaseRepository, membershipRepository } =
      createService()
    articlePurchaseRepository.findPaidPostIds.mockResolvedValue(
      new Set(['post-1']),
    )
    membershipRepository.findByReaderId.mockResolvedValue(createMembership())
    expect(
      (await resolve(service, premiumPost(), { readerId: 'reader-1' })).reason,
    ).toBe('purchase')
    expect(articlePurchaseRepository.findPaidPostIds).toHaveBeenCalledWith(
      'reader-1',
      ['post-1'],
    )
  })

  it('is membership for an active member without a purchase', async () => {
    const { service, membershipRepository } = createService()
    membershipRepository.findByReaderId.mockResolvedValue(createMembership())
    expect(
      (await resolve(service, premiumPost(), { readerId: 'reader-1' })).reason,
    ).toBe('membership')
  })

  it('is locked for anonymous readers and non-members', async () => {
    const { service, membershipRepository, articlePurchaseRepository } =
      createService()
    membershipRepository.findByReaderId.mockResolvedValue(null)
    expect(await resolve(service, premiumPost())).toEqual({
      reason: 'locked',
      locked: true,
    })
    expect(articlePurchaseRepository.findPaidPostIds).not.toHaveBeenCalled()
    expect(
      (await resolve(service, premiumPost(), { readerId: 'reader-1' })).reason,
    ).toBe('locked')
  })

  it('unlocks via article purchase when only article purchase is enabled', async () => {
    const { service, articlePurchaseRepository } = createService({
      enabled: false,
      provider: 'dodo',
      apiKey: 'api-key',
      webhookSigningKey: 'webhook-key',
      articlePurchaseEnabled: true,
      articleProductId: 'prod_article',
    })
    articlePurchaseRepository.findPaidPostIds.mockResolvedValue(
      new Set(['post-1']),
    )
    expect(
      (await resolve(service, premiumPost(), { readerId: 'reader-1' })).reason,
    ).toBe('purchase')
  })

  it('resolves a batch with one purchase and one membership lookup', async () => {
    const { service, articlePurchaseRepository, membershipRepository } =
      createService()
    articlePurchaseRepository.findPaidPostIds.mockResolvedValue(new Set(['b']))
    membershipRepository.findByReaderId.mockResolvedValue(null)
    const result = await service.resolvePostEntitlements({
      posts: [
        { id: 'a', isPremium: false },
        { id: 'b', isPremium: true, isPublished: true },
        { id: 'c', isPremium: true, isPublished: true },
      ],
      isOwner: false,
      readerId: 'reader-1',
    })
    expect(result.get('a')?.reason).toBe('public')
    expect(result.get('b')?.reason).toBe('purchase')
    expect(result.get('c')?.reason).toBe('locked')
    expect(articlePurchaseRepository.findPaidPostIds).toHaveBeenCalledTimes(1)
    expect(membershipRepository.findByReaderId).toHaveBeenCalledTimes(1)
  })
})
