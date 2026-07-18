import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { DodoProvider } from '~/modules/membership/providers/dodo.provider'

const verifyMock = vi.fn()
const checkoutCreateMock = vi.fn()
const productsRetrieveMock = vi.fn()

vi.mock('standardwebhooks', () => ({
  Webhook: class MockWebhook {
    verify = verifyMock
  },
}))

vi.mock('dodopayments', () => ({
  default: class MockDodoPayments {
    checkoutSessions = { create: checkoutCreateMock }
    products = { retrieve: productsRetrieveMock }
  },
}))

describe('DodoProvider', () => {
  let configsService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    verifyMock.mockReset()
    checkoutCreateMock.mockReset()
    productsRetrieveMock.mockReset()

    configsService = {
      get: vi.fn().mockResolvedValue({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'prod_monthly',
        yearlyProductId: 'prod_yearly',
        dodoApiKey: 'test-dodo-api-key',
        dodoWebhookKey: 'test-dodo-webhook-key',
        dodoEnvironment: 'test_mode',
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

    it('forwards returnUrl as return_url and omits it when absent', async () => {
      checkoutCreateMock.mockResolvedValue({
        session_id: 'sess_r',
        checkout_url: 'https://checkout.dodopayments.com/sess_r',
      })

      const provider = new DodoProvider(configsService as any)
      await provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
        returnUrl: 'https://blog.example.com/posts/tech/foo?membership=success',
      })
      expect(checkoutCreateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          return_url:
            'https://blog.example.com/posts/tech/foo?membership=success',
        }),
      )

      await provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
      })
      expect(checkoutCreateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ return_url: undefined }),
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

    it('throws MEMBERSHIP_PROVIDER_NOT_CONFIGURED when dodoApiKey is empty', async () => {
      configsService.get.mockResolvedValue({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'prod_monthly',
        yearlyProductId: 'prod_yearly',
        dodoApiKey: '',
        dodoWebhookKey: 'test-dodo-webhook-key',
        dodoEnvironment: 'test_mode',
      })

      const provider = new DodoProvider(configsService as any)

      await expect(
        provider.createCheckout({
          reader: { id: 'reader-1' },
          plan: 'monthly',
        }),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED,
      })
    })

    it('rebuilds the client when the configured api key or environment changes', async () => {
      const DodoPayments = (await import('dodopayments')).default as any

      checkoutCreateMock.mockResolvedValue({
        session_id: 'sess_1',
        checkout_url: 'https://checkout.dodopayments.com/sess_1',
      })

      const provider = new DodoProvider(configsService as any)
      await provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
      })
      const firstClient = (provider as any).client

      configsService.get.mockResolvedValue({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'prod_monthly',
        yearlyProductId: 'prod_yearly',
        dodoApiKey: 'rotated-dodo-api-key',
        dodoWebhookKey: 'test-dodo-webhook-key',
        dodoEnvironment: 'live_mode',
      })
      await provider.createCheckout({
        reader: { id: 'reader-1' },
        plan: 'monthly',
      })
      const secondClient = (provider as any).client

      expect(secondClient).not.toBe(firstClient)
      expect(secondClient).toBeInstanceOf(DodoPayments)
    })
  })

  describe('getPlanPricing', () => {
    it('normalizes a recurring price and caches it', async () => {
      productsRetrieveMock.mockResolvedValue({
        name: 'VIP',
        price: {
          price: 500,
          currency: 'USD',
          payment_frequency_interval: 'Month',
          payment_frequency_count: 1,
        },
      })

      const provider = new DodoProvider(configsService as any)
      const first = await provider.getPlanPricing('prod_monthly')
      const second = await provider.getPlanPricing('prod_monthly')

      expect(first).toEqual({
        amount: 500,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      })
      expect(second).toEqual(first)
      expect(productsRetrieveMock).toHaveBeenCalledTimes(1)
    })

    it('returns null when the provider call throws', async () => {
      productsRetrieveMock.mockRejectedValue(new Error('boom'))

      const provider = new DodoProvider(configsService as any)
      expect(await provider.getPlanPricing('prod_x')).toBeNull()
    })

    it('returns null when the price is not recurring', async () => {
      productsRetrieveMock.mockResolvedValue({
        price: { price: 500, currency: 'USD', type: 'one_time_price' },
      })

      const provider = new DodoProvider(configsService as any)
      expect(await provider.getPlanPricing('prod_y')).toBeNull()
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

    it('throws MEMBERSHIP_PROVIDER_NOT_CONFIGURED when dodoWebhookKey is empty', async () => {
      configsService.get.mockResolvedValue({
        enabled: true,
        provider: 'dodo',
        monthlyProductId: 'prod_monthly',
        yearlyProductId: 'prod_yearly',
        dodoApiKey: 'test-dodo-api-key',
        dodoWebhookKey: '',
        dodoEnvironment: 'test_mode',
      })

      const provider = new DodoProvider(configsService as any)

      await expect(
        provider.verifyAndParseWebhook('{}', headers),
      ).rejects.toMatchObject({
        code: AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED,
      })
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
