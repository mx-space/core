import type { MembershipPlan } from '../membership.types'
import type { NormalizedBillingEvent } from './provider.interface'

export interface AppleDecodedTransaction {
  appAccountToken?: string
  expiresDate: number
  originalTransactionId: string
  productId: string
  revocationDate?: number
  transactionId: string
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
  REVOKE: 'cancelled',
  GRACE_PERIOD_EXPIRED: 'cancelled',
  DID_CHANGE_RENEWAL_PREF: 'plan_changed',
}

export function appleNotificationEventType(
  notificationType: string,
): NormalizedBillingEvent['type'] | undefined {
  return NOTIFICATION_TYPE_MAP[notificationType]
}
