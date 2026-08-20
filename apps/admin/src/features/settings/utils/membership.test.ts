import { describe, expect, it } from 'vitest'

import {
  buildMembershipWebhookUrl,
  getAppleIapSetupChecks,
  getMembershipSetupChecks,
  getMembershipSetupProgress,
} from './membership'

describe('buildMembershipWebhookUrl', () => {
  it('uses the active API base and selected provider', () => {
    expect(
      buildMembershipWebhookUrl('https://mx.example.com/api/v3/', 'dodo'),
    ).toBe('https://mx.example.com/api/v3/membership/webhook/dodo')
  })

  it('builds the Apple webhook URL', () => {
    expect(
      buildMembershipWebhookUrl('https://mx.example.com/api/v3/', 'apple'),
    ).toBe('https://mx.example.com/api/v3/membership/webhook/apple')
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

describe('getAppleIapSetupChecks', () => {
  it('is complete when all Apple fields or persisted private key are present', () => {
    expect(
      getAppleIapSetupChecks(
        {
          appleAppAppleId: '1234567890',
          appleBundleId: 'dev.yohaku.app',
          appleIssuerId: 'ISSUER',
          appleKeyId: 'KEYID',
          appleMonthlyProductId: 'monthly',
          appleYearlyProductId: 'yearly',
        },
        {
          apiKeyConfigured: false,
          applePrivateKeyConfigured: true,
          supportedProviders: ['dodo'],
          webhookSigningKeyConfigured: false,
        },
      ),
    ).toEqual({
      appAppleId: true,
      bundleId: true,
      issuerId: true,
      keyId: true,
      monthlyProductId: true,
      privateKey: true,
      yearlyProductId: true,
    })
  })

  it.each(['', '0', '-1', '1.5', 'not-a-number'])(
    'rejects an invalid App Apple ID: %s',
    (appleAppAppleId) => {
      const checks = getAppleIapSetupChecks(
        {
          appleAppAppleId,
          appleBundleId: 'dev.yohaku.app',
          appleIssuerId: 'ISSUER',
          appleKeyId: 'KEYID',
          appleMonthlyProductId: 'monthly',
          applePrivateKey: 'private-key',
          appleYearlyProductId: 'yearly',
        },
        {
          apiKeyConfigured: false,
          supportedProviders: ['dodo'],
          webhookSigningKeyConfigured: false,
        },
      )

      expect(checks.appAppleId).toBe(false)
    },
  )

  it('lets a complete Apple-only setup satisfy the enable gate', () => {
    const status = {
      apiKeyConfigured: false,
      supportedProviders: ['dodo'],
      webhookSigningKeyConfigured: false,
    }
    const membershipChecks = getMembershipSetupChecks({}, status)
    const appleChecks = getAppleIapSetupChecks(
      {
        appleAppAppleId: '1234567890',
        appleBundleId: 'dev.yohaku.app',
        appleIssuerId: 'ISSUER',
        appleKeyId: 'KEYID',
        appleMonthlyProductId: 'monthly',
        applePrivateKey: 'private-key',
        appleYearlyProductId: 'yearly',
      },
      status,
    )

    expect(getMembershipSetupProgress(membershipChecks, appleChecks)).toEqual({
      completedCount: 7,
      setupComplete: true,
      totalCount: 7,
    })
  })
})
