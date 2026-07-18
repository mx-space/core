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
}

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
  ) => Promise<NormalizedBillingEvent>

  getPortalUrl?: (customerId: string) => Promise<string>
}
