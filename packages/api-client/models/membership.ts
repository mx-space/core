export type MembershipProvider =
  'dodo' | 'creem' | 'lemonsqueezy' | 'stripe' | 'manual'

export type MembershipPlan = 'monthly' | 'yearly'

export type MembershipStatus = 'active' | 'on_hold' | 'cancelled' | 'expired'

export interface MembershipCheckoutResult {
  checkoutUrl: string
}

export interface MembershipPlanPricing {
  amount: number
  currency: string
  interval: 'day' | 'week' | 'month' | 'year'
  intervalCount: number
}

export interface MembershipPlanInfo {
  plan: MembershipPlan
  pricing?: MembershipPlanPricing
}

export interface MembershipPlansResult {
  enabled: boolean
  plans: MembershipPlanInfo[]
}

export interface MembershipStatusResultNone {
  status: 'none'
}

export interface MembershipStatusResultActive {
  status: MembershipStatus
  plan: MembershipPlan
  provider: MembershipProvider
  currentPeriodEnd: string
}

export type MembershipStatusResult =
  MembershipStatusResultNone | MembershipStatusResultActive
