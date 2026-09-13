import { describe, expect, it } from 'vitest'

import {
  buildMembershipWebhookUrl,
  formatArticlePrice,
  getAppleIapSetupChecks,
  getMembershipSetupChecks,
  getMembershipSetupProgress,
} from './membership'

describe('formatArticlePrice', () => {
  it('divides by 100 for two-decimal currencies', () => {
    expect(formatArticlePrice({ amount: 300, currency: 'USD' })).toBe(
      new Intl.NumberFormat(undefined, {
        currency: 'USD',
        style: 'currency',
      }).format(3),
    )
  })

  it('does not divide for zero-decimal currencies', () => {
    expect(formatArticlePrice({ amount: 300, currency: 'JPY' })).toBe(
      new Intl.NumberFormat(undefined, {
        currency: 'JPY',
        style: 'currency',
      }).format(300),
    )
  })

  it('returns null when price is missing', () => {
    expect(formatArticlePrice(undefined)).toBeNull()
  })
})

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
      articleProduct: true,
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

  it('requires an article product id only when single article purchase is enabled', () => {
    const status = {
      apiKeyConfigured: true,
      supportedProviders: ['dodo'],
      webhookSigningKeyConfigured: true,
    }

    expect(
      getMembershipSetupChecks(
        { articlePurchaseEnabled: true, provider: 'dodo' },
        status,
      ).articleProduct,
    ).toBe(false)

    expect(
      getMembershipSetupChecks(
        {
          articleProductId: 'pdt_article',
          articlePurchaseEnabled: true,
          provider: 'dodo',
        },
        status,
      ).articleProduct,
    ).toBe(true)

    expect(
      getMembershipSetupChecks({ provider: 'dodo' }, status).articleProduct,
    ).toBe(true)
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
