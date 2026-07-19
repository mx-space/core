import type {
  ReaderMembership,
  ReaderMembershipStatusFilter,
} from '~/api/readers'
import type { TranslationKey } from '~/i18n/types'

export const MEMBERSHIP_STATUS_TONE = {
  active: 'live',
  on_hold: 'pending',
  cancelled: 'archived',
  expired: 'error',
  none: 'archived',
} as const

export const MEMBERSHIP_STATUS_LABEL_KEY: Record<
  ReaderMembershipStatusFilter,
  TranslationKey
> = {
  active: 'readers.membership.status.active',
  on_hold: 'readers.membership.status.onHold',
  cancelled: 'readers.membership.status.cancelled',
  expired: 'readers.membership.status.expired',
  none: 'readers.membership.status.none',
}

export const MEMBERSHIP_PLAN_LABEL_KEY: Record<
  ReaderMembership['plan'],
  TranslationKey
> = {
  monthly: 'readers.membership.plan.monthly',
  yearly: 'readers.membership.plan.yearly',
}

export function effectiveMembershipStatus(
  membership: ReaderMembership | null | undefined,
): ReaderMembershipStatusFilter {
  if (!membership) return 'none'
  if (membership.status === 'cancelled') return 'cancelled'

  const periodEnd = new Date(membership.currentPeriodEnd).getTime()
  const lapsed = Number.isFinite(periodEnd) && periodEnd <= Date.now()

  return lapsed ? 'expired' : membership.status
}

export function providerLabel(provider: ReaderMembership['provider']): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

export function hasLiveProviderManagedMembership(
  membership: ReaderMembership | null | undefined,
): boolean {
  if (!membership || membership.provider === 'manual') return false
  if (membership.status === 'active' || membership.status === 'on_hold') {
    return new Date(membership.currentPeriodEnd).getTime() > Date.now()
  }
  return false
}
