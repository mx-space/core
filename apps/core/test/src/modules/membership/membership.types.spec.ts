import { describe, expect, it } from 'vitest'

import {
  type MembershipRow,
  resolveAppleIapAvailability,
  resolveGrantExtension,
  resolveMembershipAvailability,
  resolveMembershipReturnUrl,
} from '~/modules/membership/membership.types'

const providerCredentials = {
  apiKey: 'api-key',
  webhookSigningKey: 'webhook-key',
}

describe('resolveMembershipAvailability', () => {
  it('is enabled with both plans when fully configured', () => {
    expect(
      resolveMembershipAvailability({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'm',
        yearlyProductId: 'y',
        ...providerCredentials,
      }),
    ).toEqual({ enabled: true, plans: ['monthly', 'yearly'] })
  })

  it('lists only the plans whose product id is set', () => {
    expect(
      resolveMembershipAvailability({
        enabled: true,
        provider: 'dodo',
        yearlyProductId: 'y',
        ...providerCredentials,
      }),
    ).toEqual({ enabled: true, plans: ['yearly'] })
  })

  it('is disabled (empty plans) when toggle off, provider missing, or no product id', () => {
    expect(
      resolveMembershipAvailability({
        enabled: false,
        provider: 'dodo',
        monthlyProductId: 'm',
        ...providerCredentials,
      }),
    ).toEqual({ enabled: false, plans: [] })
    expect(
      resolveMembershipAvailability({ enabled: true, monthlyProductId: 'm' }),
    ).toEqual({ enabled: false, plans: [] })
    expect(
      resolveMembershipAvailability({ enabled: true, provider: 'dodo' }),
    ).toEqual({ enabled: false, plans: [] })
  })

  it('is disabled when the provider has no registered adapter', () => {
    expect(
      resolveMembershipAvailability({
        enabled: true,
        provider: 'stripe',
        monthlyProductId: 'm',
      }),
    ).toEqual({ enabled: false, plans: [] })
  })

  it('is disabled when a required provider credential is absent', () => {
    expect(
      resolveMembershipAvailability({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'm',
        webhookSigningKey: 'webhook-key',
      }),
    ).toEqual({ enabled: false, plans: [] })
    expect(
      resolveMembershipAvailability({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'm',
        apiKey: 'api-key',
      }),
    ).toEqual({ enabled: false, plans: [] })
  })
})

describe('resolveMembershipReturnUrl', () => {
  const web = 'https://blog.example.com'

  it('joins a relative path onto webUrl and appends the marker', () => {
    expect(resolveMembershipReturnUrl('/posts/tech/foo', web)).toBe(
      'https://blog.example.com/posts/tech/foo?membership=success',
    )
  })

  it('preserves existing query and adds the marker', () => {
    expect(resolveMembershipReturnUrl('/posts/foo?ref=x', web)).toBe(
      'https://blog.example.com/posts/foo?ref=x&membership=success',
    )
  })

  it('returns undefined when webUrl or returnPath is missing', () => {
    expect(resolveMembershipReturnUrl(undefined, web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/posts/foo', undefined)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/posts/foo', '')).toBeUndefined()
  })

  it('rejects absolute, protocol-relative, and backslash paths (open redirect guard)', () => {
    expect(resolveMembershipReturnUrl('https://evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('//evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/\\evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('posts/foo', web)).toBeUndefined()
  })

  it('returns undefined when webUrl is not a valid URL', () => {
    expect(
      resolveMembershipReturnUrl('/posts/foo', 'not-a-url'),
    ).toBeUndefined()
  })
})

const appleCredentials = {
  appleAppAppleId: '1234567890',
  appleBundleId: 'dev.yohaku.app',
  appleKeyId: 'KEYID',
  appleIssuerId: 'ISSUER',
  applePrivateKey: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----',
  appleMonthlyProductId: 'yohaku.membership.monthly',
  appleYearlyProductId: 'yohaku.membership.yearly',
}

describe('resolveAppleIapAvailability', () => {
  it('is enabled when the master switch and all Apple fields are set', () => {
    expect(
      resolveAppleIapAvailability({ enabled: true, ...appleCredentials }),
    ).toEqual({
      enabled: true,
      monthlyProductId: 'yohaku.membership.monthly',
      yearlyProductId: 'yohaku.membership.yearly',
    })
  })

  it('is disabled when the master switch is off', () => {
    expect(
      resolveAppleIapAvailability({ enabled: false, ...appleCredentials }),
    ).toEqual({ enabled: false })
  })

  it('is disabled when any Apple field is missing', () => {
    expect(
      resolveAppleIapAvailability({
        enabled: true,
        ...appleCredentials,
        appleKeyId: '',
      }),
    ).toEqual({ enabled: false })
  })

  it.each([undefined, '', 'not-a-number', '1.5', '0'])(
    'is disabled when the App Apple ID is not a positive integer (%s)',
    (appleAppAppleId) => {
      expect(
        resolveAppleIapAvailability({
          enabled: true,
          ...appleCredentials,
          appleAppAppleId,
        }),
      ).toEqual({ enabled: false })
    },
  )
})

describe('resolveGrantExtension', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const row = (overrides: Partial<MembershipRow>): MembershipRow => ({
    id: 'm' as any,
    readerId: 'r',
    provider: 'manual',
    providerCustomerId: null,
    providerSubscriptionId: null,
    plan: 'monthly',
    status: 'active',
    currentPeriodEnd: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })

  it('starts from now when no membership', () => {
    const r = resolveGrantExtension(null, 3, now)
    expect(r.plan).toBe('monthly')
    expect(r.expiresAt.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('extends an unexpired active membership from its period end', () => {
    const end = new Date('2026-06-01T00:00:00.000Z')
    const r = resolveGrantExtension(row({ currentPeriodEnd: end }), 12, now)
    expect(r.plan).toBe('yearly')
    expect(r.expiresAt.toISOString()).toBe('2027-06-01T00:00:00.000Z')
  })

  it('starts from now when expired or cancelled', () => {
    const past = new Date('2025-06-01T00:00:00.000Z')
    expect(
      resolveGrantExtension(
        row({ currentPeriodEnd: past }),
        1,
        now,
      ).expiresAt.toISOString(),
    ).toBe('2026-02-01T00:00:00.000Z')
    expect(
      resolveGrantExtension(
        row({ status: 'cancelled', currentPeriodEnd: new Date('2027-01-01') }),
        1,
        now,
      ).expiresAt.toISOString(),
    ).toBe('2026-02-01T00:00:00.000Z')
  })
})
