import { Environment } from '@apple/app-store-server-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppleProvider } from '~/modules/membership/providers/apple.provider'

const get = vi.fn()

describe('AppleProvider', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('refuses web checkout', async () => {
    const provider = new AppleProvider({ get } as any)
    await expect(
      provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED,
    })
  })

  it('accepts a verified production transaction and preserves revocation metadata', async () => {
    get.mockResolvedValue({
      appleAppAppleId: '1234567890',
      appleBundleId: 'dev.yohaku.app',
    })
    const provider = new AppleProvider({ get } as any)
    vi.spyOn(
      provider as any,
      'verifyTransactionWithFallback',
    ).mockResolvedValue({
      environment: Environment.PRODUCTION,
      expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
      originalTransactionId: 'original-1',
      productId: 'yohaku.membership.monthly',
      revocationDate: Date.parse('2026-08-21T00:00:00.000Z'),
      signedDate: Date.parse('2026-08-01T00:00:00.000Z'),
      transactionId: 'transaction-1',
    })

    await expect(
      provider.verifySignedTransaction('signed-transaction'),
    ).resolves.toMatchObject({
      revocationDate: Date.parse('2026-08-21T00:00:00.000Z'),
    })
  })

  it('preserves the verified sandbox environment for entitlement isolation', async () => {
    get.mockResolvedValue({
      appleAppAppleId: '1234567890',
      appleBundleId: 'dev.yohaku.app',
    })
    const provider = new AppleProvider({ get } as any)
    vi.spyOn(
      provider as any,
      'verifyTransactionWithFallback',
    ).mockResolvedValue({
      environment: Environment.SANDBOX,
      expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
      originalTransactionId: 'sandbox-original-1',
      productId: 'yohaku.membership.monthly',
      signedDate: Date.parse('2026-08-01T00:00:00.000Z'),
      transactionId: 'sandbox-transaction-1',
    })

    await expect(
      provider.verifySignedTransaction('sandbox-signed-transaction'),
    ).resolves.toMatchObject({
      environment: 'sandbox',
      transactionId: 'sandbox-transaction-1',
    })
  })

  it('ignores a verified sandbox notification before parsing its transaction', async () => {
    get.mockResolvedValue({
      appleAppAppleId: '1234567890',
      appleBundleId: 'dev.yohaku.app',
    })
    const provider = new AppleProvider({ get } as any)
    vi.spyOn(
      provider as any,
      'verifyNotificationWithFallback',
    ).mockResolvedValue({
      data: {
        environment: Environment.SANDBOX,
        signedTransactionInfo: 'sandbox-signed-transaction',
      },
      notificationType: 'DID_RENEW',
      notificationUUID: 'sandbox-notification-1',
      signedDate: Date.parse('2026-08-21T00:00:00.000Z'),
    })
    const verifyTransaction = vi.spyOn(
      provider as any,
      'verifyTransactionWithFallback',
    )

    await expect(
      provider.verifyAndParseWebhook(
        JSON.stringify({ signedPayload: 'sandbox-notification-jws' }),
        {},
      ),
    ).resolves.toEqual({
      ignored: true,
      rawType: 'DID_RENEW',
      reason: 'sandbox_environment',
    })
    expect(verifyTransaction).not.toHaveBeenCalled()
  })

  it.each([
    ['DID_RENEW', 'renewed'],
    ['RENEWAL_EXTENDED', 'renewed'],
    ['REFUND_REVERSED', 'renewed'],
    ['DID_CHANGE_RENEWAL_PREF', 'plan_changed'],
  ] as const)(
    'maps the current Apple product during %s',
    async (notificationType, expectedType) => {
      get.mockResolvedValue({
        appleAppAppleId: '1234567890',
        appleBundleId: 'dev.yohaku.app',
        appleMonthlyProductId: 'yohaku.membership.monthly',
        appleYearlyProductId: 'yohaku.membership.yearly',
      })
      const provider = new AppleProvider({ get } as any)
      vi.spyOn(
        provider as any,
        'verifyNotificationWithFallback',
      ).mockResolvedValue({
        data: { signedTransactionInfo: 'signed-transaction' },
        notificationType,
        notificationUUID: 'notification-1',
        signedDate: Date.parse('2026-08-21T00:00:00.000Z'),
      })
      vi.spyOn(
        provider as any,
        'verifyTransactionWithFallback',
      ).mockResolvedValue({
        environment: Environment.PRODUCTION,
        expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
        originalTransactionId: 'original-1',
        productId: 'yohaku.membership.yearly',
      })

      await expect(
        provider.verifyAndParseWebhook(
          JSON.stringify({ signedPayload: 'notification-jws' }),
          {},
        ),
      ).resolves.toMatchObject({
        event: { plan: 'yearly', type: expectedType },
      })
    },
  )

  it('uses the signed renewal grace-period deadline after a failed renewal', async () => {
    get.mockResolvedValue({
      appleAppAppleId: '1234567890',
      appleBundleId: 'dev.yohaku.app',
      appleMonthlyProductId: 'yohaku.membership.monthly',
      appleYearlyProductId: 'yohaku.membership.yearly',
    })
    const provider = new AppleProvider({ get } as any)
    vi.spyOn(
      provider as any,
      'verifyNotificationWithFallback',
    ).mockResolvedValue({
      data: {
        signedRenewalInfo: 'signed-renewal',
        signedTransactionInfo: 'signed-transaction',
      },
      notificationType: 'DID_FAIL_TO_RENEW',
      notificationUUID: 'notification-1',
      signedDate: Date.parse('2026-08-21T00:00:00.000Z'),
      subtype: 'GRACE_PERIOD',
    })
    vi.spyOn(
      provider as any,
      'verifyTransactionWithFallback',
    ).mockResolvedValue({
      environment: Environment.PRODUCTION,
      expiresDate: Date.parse('2026-08-20T00:00:00.000Z'),
      originalTransactionId: 'original-1',
      productId: 'yohaku.membership.monthly',
    })
    vi.spyOn(
      provider as any,
      'verifyRenewalInfoWithFallback',
    ).mockResolvedValue({
      gracePeriodExpiresDate: Date.parse('2026-08-27T00:00:00.000Z'),
      originalTransactionId: 'original-1',
    })

    const result = await provider.verifyAndParseWebhook(
      JSON.stringify({ signedPayload: 'notification-jws' }),
      {},
    )

    expect(result).toMatchObject({
      event: {
        currentPeriodEnd: new Date('2026-08-27T00:00:00.000Z'),
        occurredAt: new Date('2026-08-21T00:00:00.000Z'),
        type: 'on_hold',
      },
    })
  })
})
