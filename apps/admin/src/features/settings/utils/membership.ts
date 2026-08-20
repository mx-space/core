export const MEMBERSHIP_WEBHOOK_EVENTS = [
  'subscription.active',
  'subscription.renewed',
  'subscription.on_hold',
  'subscription.cancelled',
  'subscription.expired',
  'subscription.plan_changed',
] as const

export interface MembershipConfigValue {
  apiKey?: string
  appleAppAppleId?: string
  appleBundleId?: string
  appleIssuerId?: string
  appleKeyId?: string
  appleMonthlyProductId?: string
  applePrivateKey?: string
  appleYearlyProductId?: string
  enabled?: boolean
  environment?: string
  monthlyProductId?: string
  provider?: string
  webhookSigningKey?: string
  yearlyProductId?: string
}

export interface MembershipCredentialStatus {
  apiKeyConfigured: boolean
  applePrivateKeyConfigured?: boolean
  supportedProviders: string[]
  webhookSigningKeyConfigured: boolean
}

export function buildMembershipWebhookUrl(apiUrl: string, provider = 'dodo') {
  return `${apiUrl.replace(/\/+$/, '')}/membership/webhook/${encodeURIComponent(provider)}`
}

export function getMembershipSetupChecks(
  config: MembershipConfigValue,
  status?: MembershipCredentialStatus,
) {
  const provider = config.provider || 'dodo'
  const hasApiKey =
    Boolean(config.apiKey?.trim()) || Boolean(status?.apiKeyConfigured)
  const hasWebhookSigningKey =
    Boolean(config.webhookSigningKey?.trim()) ||
    Boolean(status?.webhookSigningKeyConfigured)

  return {
    apiKey: hasApiKey,
    product: Boolean(
      config.monthlyProductId?.trim() || config.yearlyProductId?.trim(),
    ),
    provider: Boolean(status?.supportedProviders.includes(provider)),
    webhookSigningKey: hasWebhookSigningKey,
  }
}

export function getAppleIapSetupChecks(
  config: MembershipConfigValue,
  status?: MembershipCredentialStatus,
) {
  const hasPrivateKey =
    Boolean(config.applePrivateKey?.trim()) ||
    Boolean(status?.applePrivateKeyConfigured)
  return {
    bundleId: Boolean(config.appleBundleId?.trim()),
    issuerId: Boolean(config.appleIssuerId?.trim()),
    keyId: Boolean(config.appleKeyId?.trim()),
    monthlyProductId: Boolean(config.appleMonthlyProductId?.trim()),
    privateKey: hasPrivateKey,
    yearlyProductId: Boolean(config.appleYearlyProductId?.trim()),
  }
}
