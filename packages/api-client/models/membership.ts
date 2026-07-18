export type MembershipProvider =
  'dodo' | 'creem' | 'lemonsqueezy' | 'stripe' | 'manual'

export type MembershipPlan = 'monthly' | 'yearly'

export type MembershipStatus = 'active' | 'on_hold' | 'cancelled' | 'expired'

export interface MembershipCheckoutResult {
  checkoutUrl: string
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
