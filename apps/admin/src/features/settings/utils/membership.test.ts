import { describe, expect, it } from 'vitest'

import {
  buildMembershipWebhookUrl,
  getMembershipSetupChecks,
} from './membership'

describe('buildMembershipWebhookUrl', () => {
  it('uses the active API base and selected provider', () => {
    expect(
      buildMembershipWebhookUrl('https://mx.example.com/api/v3/', 'dodo'),
    ).toBe('https://mx.example.com/api/v3/membership/webhook/dodo')
  })
})

describe('getMembershipSetupChecks', () => {
  it('accepts persisted secrets without exposing them in the form', () => {
    expect(
      getMembershipSetupChecks(
        {
          monthlyProductId: 'prod_monthly',
          provider: 'dodo',
        },
        {
          apiKeyConfigured: true,
          supportedProviders: ['dodo'],
          webhookSigningKeyConfigured: true,
        },
      ),
    ).toEqual({
      apiKey: true,
      product: true,
      provider: true,
      webhookSigningKey: true,
    })
  })

  it('counts newly entered secrets before they are saved', () => {
    const checks = getMembershipSetupChecks(
      {
        apiKey: 'api-key',
        provider: 'dodo',
        webhookSigningKey: 'webhook-key',
        yearlyProductId: 'prod_yearly',
      },
      {
        apiKeyConfigured: false,
        supportedProviders: ['dodo'],
        webhookSigningKeyConfigured: false,
      },
    )

    expect(Object.values(checks).every(Boolean)).toBe(true)
  })
})
