import { describe, expect, it } from 'vitest'

import {
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
