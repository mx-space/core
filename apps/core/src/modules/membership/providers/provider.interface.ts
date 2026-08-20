import type { MembershipPlan } from '../membership.types'

export interface NormalizedBillingEvent {
  eventId: string
  provider: string
  type: 'activated' | 'renewed' | 'on_hold' | 'cancelled' | 'plan_changed'
  customerId: string
  subscriptionId: string
  plan?: MembershipPlan
  currentPeriodEnd: Date
  readerId: string
  occurredAt?: Date
}

export interface VerifiedBillingEvent {
  event: NormalizedBillingEvent
  rawType: string
  rawPayload: unknown
}

export type IgnoredBillingEventReason =
  'unsupported_event' | 'missing_reader_metadata'

export interface IgnoredBillingEvent {
  ignored: true
  rawType: string
  reason: IgnoredBillingEventReason
}

export type BillingWebhookResult = VerifiedBillingEvent | IgnoredBillingEvent

export const isIgnoredBillingEvent = (
  result: BillingWebhookResult,
): result is IgnoredBillingEvent => 'ignored' in result

export interface NormalizedPlanPricing {
  amount: number
  currency: string
  interval: 'day' | 'week' | 'month' | 'year'
  intervalCount: number
}

export interface PaymentProviderAdapter {
  createCheckout: (input: {
    reader: { id: string; email?: string | null; name?: string | null }
    plan: MembershipPlan
    returnUrl?: string
  }) => Promise<{ checkoutUrl: string }>

  getPlanPricing?: (productId: string) => Promise<NormalizedPlanPricing | null>

  verifyAndParseWebhook: (
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ) => Promise<BillingWebhookResult>

  getPortalUrl?: (customerId: string) => Promise<string>
}
