import type { EntityId } from '~/shared/id/entity-id'

export type MembershipProvider =
  'dodo' | 'creem' | 'lemonsqueezy' | 'stripe' | 'manual'

export type MembershipPlan = 'monthly' | 'yearly'

export type MembershipStatus = 'active' | 'on_hold' | 'cancelled' | 'expired'

export interface MembershipRow {
  id: EntityId
  readerId: EntityId
  provider: MembershipProvider
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  plan: MembershipPlan
  status: MembershipStatus
  currentPeriodEnd: Date
  createdAt: Date
  updatedAt: Date | null
}

export function effectiveMembershipStatus(
  membership: Pick<MembershipRow, 'status' | 'currentPeriodEnd'>,
): MembershipStatus {
  if (membership.status !== 'active' && membership.status !== 'on_hold') {
    return membership.status
  }
  return membership.currentPeriodEnd.getTime() > Date.now()
    ? membership.status
    : 'expired'
}

export function resolveMembershipReturnUrl(
  returnPath: string | undefined,
  webUrl: string | undefined,
): string | undefined {
  if (!returnPath || !webUrl) return undefined
  if (!returnPath.startsWith('/') || returnPath.startsWith('//'))
    return undefined
  if (returnPath.includes('\\')) return undefined

  let base: URL
  try {
    base = new URL(webUrl)
  } catch {
    return undefined
  }

  const resolved = new URL(returnPath, base)
  if (resolved.origin !== base.origin) return undefined

  resolved.searchParams.set('membership', 'success')
  return resolved.toString()
}

export interface MembershipMemberRow extends MembershipRow {
  reader: {
    id: EntityId
    email: string | null
    name: string | null
    handle: string | null
  }
}

export interface BillingWebhookEventRow {
  id: EntityId
  provider: string
  eventId: string
  type: string
  payload: unknown
  processedAt: Date | null
  receivedAt: Date
}
