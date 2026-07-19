import { getJson } from './http'

export interface MembershipConfigStatus {
  apiKeyConfigured: boolean
  supportedProviders: string[]
  webhookSigningKeyConfigured: boolean
}

export function getMembershipConfigStatus() {
  return getJson<MembershipConfigStatus>('/membership/config-status')
}
