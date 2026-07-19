import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReaderMembership } from '~/api/readers'

import { hasLiveProviderManagedMembership } from './membership-status'

const now = new Date('2026-07-19T00:00:00.000Z')

const createMembership = (
  overrides: Partial<ReaderMembership> = {},
): ReaderMembership => ({
  status: 'active',
  plan: 'monthly',
  provider: 'dodo',
  currentPeriodEnd: new Date(now.getTime() + 60_000).toISOString(),
  ...overrides,
})

describe('hasLiveProviderManagedMembership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats active and on-hold provider memberships as live only before period end', () => {
    expect(hasLiveProviderManagedMembership(createMembership())).toBe(true)
    expect(
      hasLiveProviderManagedMembership(createMembership({ status: 'on_hold' })),
    ).toBe(true)

    const lapsed = new Date(now.getTime() - 1).toISOString()
    expect(
      hasLiveProviderManagedMembership(
        createMembership({ currentPeriodEnd: lapsed }),
      ),
    ).toBe(false)
    expect(
      hasLiveProviderManagedMembership(
        createMembership({ status: 'on_hold', currentPeriodEnd: lapsed }),
      ),
    ).toBe(false)
  })

  it('does not treat manual or cancelled memberships as provider-managed live access', () => {
    expect(
      hasLiveProviderManagedMembership(
        createMembership({ provider: 'manual' }),
      ),
    ).toBe(false)
    expect(
      hasLiveProviderManagedMembership(
        createMembership({ status: 'cancelled' }),
      ),
    ).toBe(false)
  })
})
