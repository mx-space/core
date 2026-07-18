import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { DodoProvider } from '~/modules/membership/providers/dodo.provider'

const verifyMock = vi.fn()
const checkoutCreateMock = vi.fn()

vi.mock('standardwebhooks', () => ({
  Webhook: class MockWebhook {
    verify = verifyMock
  },
}))

vi.mock('dodopayments', () => ({
  default: class MockDodoPayments {
    checkoutSessions = { create: checkoutCreateMock }
  },
}))

describe('DodoProvider', () => {
  let configsService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    verifyMock.mockReset()
    checkoutCreateMock.mockReset()

    configsService = {
      get: vi.fn().mockResolvedValue({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'prod_monthly',
        yearlyProductId: 'prod_yearly',
      }),
    }
  })

  describe('createCheckout', () => {
    it('creates a checkout session and returns the checkout url', async () => {
      checkoutCreateMock.mockResolvedValue({
        session_id: 'sess_1',
        checkout_url: 'https://checkout.dodopayments.com/sess_1',
      })

      const provider = new DodoProvider(configsService as any)
      const result = await provider.createCheckout({
        reader: { id: 'reader-1', email: 'reader@example.com', name: 'Reader' },
        plan: 'monthly',
      })

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.dodopayments.com/sess_1',
      })
      expect(checkoutCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [{ product_id: 'prod_monthly', quantity: 1 }],
          metadata: { readerId: 'reader-1' },
        }),
      )
    })

    it('uses the yearly product id for the yearly plan', async () => {
      checkoutCreateMock.mockResolvedValue({
        session_id: 'sess_2',
        checkout_url: 'https://checkout.dodopayments.com/sess_2',
      })

      const provider = new DodoProvider(configsService as any)
      await provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'yearly',
      })

      expect(checkoutCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [{ product_id: 'prod_yearly', quantity: 1 }],
        }),
      )
    })
  })

  describe('verifyAndParseWebhook', () => {
    const headers = {
      'webhook-id': 'evt_1',
      'webhook-timestamp': '1700000000',
      'webhook-signature': 'v1,signature',
    }

    it('maps subscription.active to activated', async () => {
      verifyMock.mockReturnValue({
        type: 'subscription.active',
        business_id: 'biz_1',
        timestamp: '2026-01-01T00:00:00Z',
        data: {
          subscription_id: 'sub_1',
          customer: { customer_id: 'cus_1' },
          metadata: { readerId: 'reader-1' },
          next_billing_date: '2026-02-01T00:00:00Z',
          payment_frequency_interval: 'Month',
        },
      })

      const provider = new DodoProvider(configsService as any)
      const event = await provider.verifyAndParseWebhook('{}', headers)

      expect(event).toEqual({
        eventId: 'evt_1',
        provider: 'dodo',
        type: 'activated',
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
        plan: 'monthly',
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
        readerId: 'reader-1',
      })
    })

    it.each([
      ['subscription.renewed', 'renewed'],
      ['subscription.on_hold', 'on_hold'],
      ['subscription.cancelled', 'cancelled'],
      ['subscription.expired', 'cancelled'],
      ['subscription.plan_changed', 'plan_changed'],
    ] as const)('maps %s to %s', async (dodoType, expectedType) => {
      verifyMock.mockReturnValue({
        type: dodoType,
        business_id: 'biz_1',
        timestamp: '2026-01-01T00:00:00Z',
        data: {
          subscription_id: 'sub_1',
          customer: { customer_id: 'cus_1' },
          metadata: { readerId: 'reader-1' },
          next_billing_date: '2026-02-01T00:00:00Z',
          payment_frequency_interval: 'Year',
        },
      })

      const provider = new DodoProvider(configsService as any)
      const event = await provider.verifyAndParseWebhook('{}', headers)

      expect(event.type).toBe(expectedType)
      expect(event.plan).toBe('yearly')
    })

    it('throws WebhookVerifyFailed when signature verification fails', async () => {
      verifyMock.mockImplementation(() => {
        throw new Error('invalid signature')
      })

      const provider = new DodoProvider(configsService as any)

      await expect(
        provider.verifyAndParseWebhook('{}', headers),
      ).rejects.toMatchObject({ code: AppErrorCode.WEBHOOK_VERIFY_FAILED })
    })

    it('throws WebhookVerifyFailed when readerId metadata is missing', async () => {
      verifyMock.mockReturnValue({
        type: 'subscription.active',
        business_id: 'biz_1',
        timestamp: '2026-01-01T00:00:00Z',
        data: {
          subscription_id: 'sub_1',
          customer: { customer_id: 'cus_1' },
          metadata: {},
          next_billing_date: '2026-02-01T00:00:00Z',
        },
      })

      const provider = new DodoProvider(configsService as any)

      await expect(
        provider.verifyAndParseWebhook('{}', headers),
      ).rejects.toMatchObject({ code: AppErrorCode.WEBHOOK_VERIFY_FAILED })
    })

    it('throws WebhookVerifyFailed for an unmapped event type', async () => {
      verifyMock.mockReturnValue({
        type: 'payment.succeeded',
        business_id: 'biz_1',
        timestamp: '2026-01-01T00:00:00Z',
        data: {
          subscription_id: 'sub_1',
          customer: { customer_id: 'cus_1' },
          metadata: { readerId: 'reader-1' },
          next_billing_date: '2026-02-01T00:00:00Z',
        },
      })

      const provider = new DodoProvider(configsService as any)

      await expect(
        provider.verifyAndParseWebhook('{}', headers),
      ).rejects.toMatchObject({ code: AppErrorCode.WEBHOOK_VERIFY_FAILED })
    })
  })
})
