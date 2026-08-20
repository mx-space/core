import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { AppleProvider } from '~/modules/membership/providers/apple.provider'

const get = vi.fn()

describe('AppleProvider.createCheckout', () => {
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

  it.each([
    ['DID_RENEW', 'renewed'],
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
      })
      vi.spyOn(
        provider as any,
        'verifyTransactionWithFallback',
      ).mockResolvedValue({
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
})
