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
  kind: 'membership'
  event: NormalizedBillingEvent
  rawType: string
  rawPayload: unknown
}

export type NormalizedArticlePurchaseEvent = {
  eventId: string
  occurredAt: Date
  providerPaymentId: string
  providerCustomerId?: string
} & (
  | {
      type: 'paid'
      readerId: string
      postId: string
      amount: number
      currency: string
    }
  | { type: 'refunded' }
)

export interface VerifiedArticlePurchaseEvent {
  kind: 'article'
  event: NormalizedArticlePurchaseEvent
  rawType: string
  rawPayload: unknown
}

export type IgnoredBillingEventReason =
  'unsupported_event' | 'missing_reader_metadata' | 'sandbox_environment'

export interface IgnoredBillingEvent {
  kind: 'ignored'
  rawType: string
  reason: IgnoredBillingEventReason
}

export type BillingWebhookResult =
  VerifiedBillingEvent | VerifiedArticlePurchaseEvent | IgnoredBillingEvent

export interface NormalizedPlanPricing {
  amount: number
  currency: string
  interval: 'day' | 'week' | 'month' | 'year'
  intervalCount: number
}

export interface ReaderIdentity {
  id: string
  email?: string | null
  name?: string | null
}

export interface PaymentProviderAdapter {
  createCheckout: (input: {
    reader: ReaderIdentity
    plan: MembershipPlan
    returnUrl?: string
  }) => Promise<{ checkoutUrl: string }>

  createArticleCheckout?: (input: {
    reader: ReaderIdentity
    postId: string
    productId: string
    returnUrl?: string
  }) => Promise<{ checkoutUrl: string }>

  getPlanPricing?: (productId: string) => Promise<NormalizedPlanPricing | null>

  verifyAndParseWebhook: (
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ) => Promise<BillingWebhookResult>

  getPortalUrl?: (customerId: string) => Promise<string>
}
