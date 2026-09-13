import { getJson } from './http'

export interface MembershipConfigStatus {
  apiKeyConfigured: boolean
  applePrivateKeyConfigured?: boolean
  supportedProviders: string[]
  webhookSigningKeyConfigured: boolean
}

export function getMembershipConfigStatus() {
  return getJson<MembershipConfigStatus>('/membership/config-status')
}

export interface MembershipPlansResponse {
  enabled: boolean
  articlePurchase?: {
    enabled: boolean
    price?: {
      amount: number
      currency: string
    }
  }
}

export function getMembershipPlans() {
  return getJson<MembershipPlansResponse>('/membership/plans')
}
