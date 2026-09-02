import type { EntityId } from '~/shared/id/entity-id'

import type { SponsorCsvRow } from './sponsors-csv'

export type MembershipProvider =
  'dodo' | 'creem' | 'lemonsqueezy' | 'stripe' | 'manual' | 'apple'

export const REGISTERED_PAYMENT_PROVIDERS: readonly string[] = ['dodo']

export type MembershipPlan = 'monthly' | 'yearly'

export type MembershipStatus = 'active' | 'on_hold' | 'cancelled' | 'expired'

export interface MembershipRow {
  id: EntityId
  readerId: string
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

export interface MembershipAvailability {
  enabled: boolean
  plans: MembershipPlan[]
}

export function resolveMembershipAvailability(config: {
  enabled?: boolean
  provider?: string
  monthlyProductId?: string
  yearlyProductId?: string
  apiKey?: string
  webhookSigningKey?: string
}): MembershipAvailability {
  const plans: MembershipPlan[] = []
  if (config.monthlyProductId) plans.push('monthly')
  if (config.yearlyProductId) plans.push('yearly')
  const hasProviderCredentials = !!config.apiKey && !!config.webhookSigningKey
  const enabled =
    !!config.enabled &&
    !!config.provider &&
    REGISTERED_PAYMENT_PROVIDERS.includes(config.provider) &&
    hasProviderCredentials &&
    plans.length > 0
  return { enabled, plans: enabled ? plans : [] }
}

export interface AppleIapAvailability {
  enabled: boolean
  monthlyProductId?: string
  yearlyProductId?: string
}

const nonEmpty = (value?: string) => Boolean(value?.trim())

const positiveInteger = (value?: string) => {
  const parsed = Number(value?.trim())
  return Number.isSafeInteger(parsed) && parsed > 0
}

export function resolveAppleIapAvailability(config: {
  enabled?: boolean
  appleBundleId?: string
  appleAppAppleId?: string
  appleKeyId?: string
  appleIssuerId?: string
  applePrivateKey?: string
  appleMonthlyProductId?: string
  appleYearlyProductId?: string
}): AppleIapAvailability {
  const monthlyProductId = config.appleMonthlyProductId?.trim()
  const yearlyProductId = config.appleYearlyProductId?.trim()
  const enabled =
    !!config.enabled &&
    nonEmpty(config.appleBundleId) &&
    positiveInteger(config.appleAppAppleId) &&
    nonEmpty(config.appleKeyId) &&
    nonEmpty(config.appleIssuerId) &&
    nonEmpty(config.applePrivateKey) &&
    nonEmpty(monthlyProductId) &&
    nonEmpty(yearlyProductId)
  if (!enabled) return { enabled: false }
  return { enabled: true, monthlyProductId, yearlyProductId }
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
    id: string
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

export interface SponsorReaderMatch {
  id: string
  name: string | null
  handle: string | null
  membership: MembershipRow | null
}

export interface GithubSponsorRow {
  githubId: string
  login: string
  avatarUrl: string
  tierName: string | null
  monthlyPrice: number | null
  isActive: boolean
  sponsoredAt: Date
  reader: SponsorReaderMatch | null
}

export interface SponsorCsvPreviewRow extends SponsorCsvRow {
  reader: SponsorReaderMatch | null
}

export interface SponsorGrantResult {
  granted: number
  skipped: { readerId: string; reason: string }[]
}

export function resolveGrantExtension(
  existing: MembershipRow | null,
  months: number,
  now: Date = new Date(),
): { plan: MembershipPlan; expiresAt: Date } {
  const base =
    existing && existing.status === 'active' && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now
  const expiresAt = new Date(base)
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months)
  return { plan: months >= 12 ? 'yearly' : 'monthly', expiresAt }
}
