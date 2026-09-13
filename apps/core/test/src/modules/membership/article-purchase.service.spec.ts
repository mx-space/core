import { beforeEach, describe, expect, it } from 'vitest'

import { createPgRepositoryMock, now } from '@/helper/pg-repository-mock'
import type { ArticlePurchaseRepository } from '~/modules/membership/article-purchase.repository'
import { ArticlePurchaseService } from '~/modules/membership/article-purchase.service'
import type { BillingWebhookEventRepository } from '~/modules/membership/billing-webhook-event.repository'
import type { VerifiedArticlePurchaseEvent } from '~/modules/membership/providers/provider.interface'

const paidEvent = (eventId = 'evt_1'): VerifiedArticlePurchaseEvent => ({
  kind: 'article',
  event: {
    type: 'paid',
    eventId,
    occurredAt: now,
    readerId: 'reader-1',
    postId: 'post-1',
    providerPaymentId: 'pay_1',
    providerCustomerId: 'cus_1',
    amount: 300,
    currency: 'USD',
  },
  rawType: 'payment.succeeded',
  rawPayload: { type: 'payment.succeeded' },
})

const refundedEvent = (): VerifiedArticlePurchaseEvent => ({
  kind: 'article',
  event: {
    type: 'refunded',
    eventId: 'evt_2',
    occurredAt: now,
    providerPaymentId: 'pay_1',
  },
  rawType: 'refund.succeeded',
  rawPayload: { type: 'refund.succeeded' },
})

const webhookRow = (eventId: string, processedAt: Date | null = null) => ({
  id: `row-${eventId}` as any,
  provider: 'dodo',
  eventId,
  type: 'payment.succeeded',
  payload: {},
  processedAt,
  receivedAt: now,
})

describe('ArticlePurchaseService', () => {
  let articlePurchaseRepository: ReturnType<
    typeof createPgRepositoryMock<ArticlePurchaseRepository>
  >
  let billingWebhookEventRepository: ReturnType<
    typeof createPgRepositoryMock<BillingWebhookEventRepository>
  >
  let service: ArticlePurchaseService

  beforeEach(() => {
    articlePurchaseRepository =
      createPgRepositoryMock<ArticlePurchaseRepository>()
    billingWebhookEventRepository =
      createPgRepositoryMock<BillingWebhookEventRepository>()
    billingWebhookEventRepository.create.mockImplementation(
      async (input: { eventId: string }) => webhookRow(input.eventId),
    )
    billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue(
      null,
    )
    service = new ArticlePurchaseService(
      articlePurchaseRepository,
      billingWebhookEventRepository,
    )
  })

  it('upserts a paid purchase and marks the webhook event processed', async () => {
    const result = await service.applyEvent('dodo', paidEvent())

    expect(result).toEqual({ applied: true })
    expect(billingWebhookEventRepository.create).toHaveBeenCalledWith({
      provider: 'dodo',
      eventId: 'evt_1',
      type: 'payment.succeeded',
      payload: { type: 'payment.succeeded' },
    })
    expect(articlePurchaseRepository.upsertPaid).toHaveBeenCalledWith({
      readerId: 'reader-1',
      postId: 'post-1',
      provider: 'dodo',
      providerPaymentId: 'pay_1',
      providerCustomerId: 'cus_1',
      amount: 300,
      currency: 'USD',
    })
    expect(billingWebhookEventRepository.markProcessed).toHaveBeenCalledWith(
      'row-evt_1',
      expect.any(Date),
    )
  })

  it('marks a purchase refunded by provider payment id', async () => {
    articlePurchaseRepository.markRefunded.mockResolvedValue({ id: 'p1' })

    const result = await service.applyEvent('dodo', refundedEvent())

    expect(result).toEqual({ applied: true })
    expect(articlePurchaseRepository.markRefunded).toHaveBeenCalledWith(
      'dodo',
      'pay_1',
    )
  })

  it('reports not applied when a refund matches no purchase', async () => {
    articlePurchaseRepository.markRefunded.mockResolvedValue(null)

    expect(await service.applyEvent('dodo', refundedEvent())).toEqual({
      applied: false,
    })
  })

  it('skips an already processed event id', async () => {
    billingWebhookEventRepository.create.mockResolvedValue(null)
    billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue(
      webhookRow('evt_1', now),
    )

    expect(await service.applyEvent('dodo', paidEvent())).toEqual({
      applied: false,
    })
    expect(articlePurchaseRepository.upsertPaid).not.toHaveBeenCalled()
  })

  it('applies a previously stored but unprocessed event once', async () => {
    billingWebhookEventRepository.create.mockResolvedValue(null)
    billingWebhookEventRepository.findByProviderAndEventId.mockResolvedValue(
      webhookRow('evt_1'),
    )

    expect(await service.applyEvent('dodo', paidEvent())).toEqual({
      applied: true,
    })
    expect(articlePurchaseRepository.upsertPaid).toHaveBeenCalledTimes(1)
  })

  it('hasPurchased is true only for a paid row', async () => {
    articlePurchaseRepository.findByReaderAndPost.mockResolvedValueOnce({
      status: 'paid',
    })
    expect(await service.hasPurchased('reader-1', 'post-1')).toBe(true)

    articlePurchaseRepository.findByReaderAndPost.mockResolvedValueOnce({
      status: 'refunded',
    })
    expect(await service.hasPurchased('reader-1', 'post-1')).toBe(false)

    articlePurchaseRepository.findByReaderAndPost.mockResolvedValueOnce(null)
    expect(await service.hasPurchased('reader-1', 'post-1')).toBe(false)
  })
})
