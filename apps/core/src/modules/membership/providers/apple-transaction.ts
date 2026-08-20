import { createHmac } from 'node:crypto'

import { ENCRYPT, SECURITY } from '~/app.config'

import type { MembershipPlan } from '../membership.types'
import type { NormalizedBillingEvent } from './provider.interface'

const APPLE_ACCOUNT_TOKEN_DOMAIN = 'yohaku-membership:apple-account-token:v1\0'

export interface AppleDecodedTransaction {
  appAccountToken?: string
  expiresDate: number
  originalTransactionId: string
  productId: string
  revocationDate?: number
  transactionId: string
}

export function appleAccountTokenForReader(readerId: string): string {
  const digest = createHmac('sha256', SECURITY.jwtSecret || ENCRYPT.key)
    .update(APPLE_ACCOUNT_TOKEN_DOMAIN, 'utf8')
    .update(readerId, 'utf8')
    .digest()

  // StoreKit requires a UUID. Version 8 identifies this as an application-
  // defined UUID while the RFC 4122 variant keeps it universally parseable.
  digest[6] = (digest[6] % 16) + 128
  digest[8] = (digest[8] % 64) + 128
  const hex = digest.subarray(0, 16).toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

export function planFromAppleProductId(
  productId: string,
  products: { monthlyProductId: string; yearlyProductId: string },
): MembershipPlan | null {
  if (productId === products.monthlyProductId) return 'monthly'
  if (productId === products.yearlyProductId) return 'yearly'
  return null
}

export function appleActivatedEvent(
  decoded: AppleDecodedTransaction,
  readerId: string,
  plan: MembershipPlan,
): NormalizedBillingEvent {
  return {
    eventId: decoded.transactionId,
    provider: 'apple',
    type: 'activated',
    customerId: decoded.appAccountToken ?? decoded.originalTransactionId,
    subscriptionId: decoded.originalTransactionId,
    plan,
    currentPeriodEnd: new Date(decoded.expiresDate),
    readerId,
  }
}

const NOTIFICATION_TYPE_MAP: Record<
  string,
  NormalizedBillingEvent['type'] | undefined
> = {
  SUBSCRIBED: 'activated',
  DID_RENEW: 'renewed',
  RENEWAL_EXTENDED: 'renewed',
  DID_FAIL_TO_RENEW: 'on_hold',
  EXPIRED: 'cancelled',
  REFUND: 'cancelled',
  REFUND_REVERSED: 'renewed',
  REVOKE: 'cancelled',
  GRACE_PERIOD_EXPIRED: 'cancelled',
  DID_CHANGE_RENEWAL_PREF: 'plan_changed',
}

export function appleNotificationEventType(
  notificationType: string,
): NormalizedBillingEvent['type'] | undefined {
  return NOTIFICATION_TYPE_MAP[notificationType]
}
