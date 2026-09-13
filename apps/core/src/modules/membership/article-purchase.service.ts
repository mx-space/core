import { Injectable } from '@nestjs/common'

import { ArticlePurchaseRepository } from './article-purchase.repository'
import { BillingWebhookEventRepository } from './billing-webhook-event.repository'
import { applyWebhookEventOnce } from './billing-webhook-idempotency'
import type { VerifiedArticlePurchaseEvent } from './providers/provider.interface'

@Injectable()
export class ArticlePurchaseService {
  constructor(
    private readonly articlePurchaseRepository: ArticlePurchaseRepository,
    private readonly billingWebhookEventRepository: BillingWebhookEventRepository,
  ) {}

  async applyEvent(
    provider: string,
    verified: VerifiedArticlePurchaseEvent,
  ): Promise<{ applied: boolean }> {
    const { event, rawType, rawPayload } = verified
    return applyWebhookEventOnce(
      this.billingWebhookEventRepository,
      { provider, eventId: event.eventId, type: rawType, payload: rawPayload },
      async () => {
        if (event.type === 'paid') {
          await this.articlePurchaseRepository.upsertPaid({
            readerId: event.readerId,
            postId: event.postId,
            provider,
            providerPaymentId: event.providerPaymentId,
            providerCustomerId: event.providerCustomerId,
            amount: event.amount,
            currency: event.currency,
          })
          return true
        }
        const refunded = await this.articlePurchaseRepository.markRefunded(
          provider,
          event.providerPaymentId,
        )
        return refunded !== null
      },
    )
  }

  async hasPurchased(readerId: string, postId: string): Promise<boolean> {
    const row = await this.articlePurchaseRepository.findByReaderAndPost(
      readerId,
      postId,
    )
    return row?.status === 'paid'
  }

  async getPurchasedPostIds(
    readerId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    return this.articlePurchaseRepository.findPaidPostIds(readerId, postIds)
  }
}
