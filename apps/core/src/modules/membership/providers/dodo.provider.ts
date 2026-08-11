import { Injectable, Logger } from '@nestjs/common'
import type DodoPayments from 'dodopayments'
import { Webhook } from 'standardwebhooks'

import { AppErrorCode, createAppException } from '~/common/errors'

import { ConfigsService } from '../../configs/configs.service'
import type { MembershipPlan } from '../membership.types'
import type {
  BillingWebhookResult,
  NormalizedBillingEvent,
  NormalizedPlanPricing,
  PaymentProviderAdapter,
} from './provider.interface'

const PRICING_TTL_MS = 10 * 60 * 1000

const normalizeInterval = (
  interval: unknown,
): NormalizedPlanPricing['interval'] | null => {
  const value = String(interval).toLowerCase()
  if (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year'
  ) {
    return value
  }
  return null
}

type DodoSubscriptionStatus =
  'pending' | 'active' | 'on_hold' | 'cancelled' | 'failed' | 'expired'

type DodoSubscriptionEvent = {
  type: string
  business_id: string
  timestamp: string
  data: {
    subscription_id: string
    customer: { customer_id: string }
    metadata?: Record<string, string>
    next_billing_date: string
    payment_frequency_interval?: 'Day' | 'Week' | 'Month' | 'Year'
    status?: DodoSubscriptionStatus
  }
}

const DODO_EVENT_TYPE_MAP: Record<
  string,
  NormalizedBillingEvent['type'] | undefined
> = {
  'subscription.active': 'activated',
  'subscription.renewed': 'renewed',
  'subscription.on_hold': 'on_hold',
  'subscription.cancelled': 'cancelled',
  'subscription.expired': 'cancelled',
  'subscription.failed': 'cancelled',
  'subscription.plan_changed': 'plan_changed',
}

const DODO_STATUS_TYPE_MAP: Record<
  DodoSubscriptionStatus,
  NormalizedBillingEvent['type'] | undefined
> = {
  pending: undefined,
  active: 'activated',
  on_hold: 'on_hold',
  cancelled: 'cancelled',
  failed: 'cancelled',
  expired: 'cancelled',
}

// These two name no transition — the resulting state lives in `data.status`,
// so it is resolved there instead of from the event name.
const DODO_STATUS_DERIVED_EVENTS = new Set([
  'subscription.updated',
  'subscription.update_payment_method',
])

const resolveEventType = (
  event: DodoSubscriptionEvent,
): NormalizedBillingEvent['type'] | undefined => {
  if (!DODO_STATUS_DERIVED_EVENTS.has(event.type)) {
    return DODO_EVENT_TYPE_MAP[event.type]
  }
  return event.data.status ? DODO_STATUS_TYPE_MAP[event.data.status] : undefined
}

const planFromInterval = (
  interval: DodoSubscriptionEvent['data']['payment_frequency_interval'],
): MembershipPlan | undefined => {
  if (interval === 'Month') return 'monthly'
  if (interval === 'Year') return 'yearly'
  return undefined
}

const planFromEvent = (
  event: DodoSubscriptionEvent,
): MembershipPlan | undefined => {
  const metadataPlan = event.data.metadata?.plan
  if (metadataPlan === 'monthly' || metadataPlan === 'yearly') {
    return metadataPlan
  }
  return planFromInterval(event.data.payment_frequency_interval)
}

@Injectable()
export class DodoProvider implements PaymentProviderAdapter {
  private readonly logger = new Logger(DodoProvider.name)
  private client: DodoPayments | null = null
  private cachedApiKey: string | null = null
  private cachedEnvironment: 'test_mode' | 'live_mode' | null = null
  private readonly pricingCache = new Map<
    string,
    { value: NormalizedPlanPricing | null; expiresAt: number }
  >()

  constructor(private readonly configsService: ConfigsService) {}

  private async getClient(
    apiKey: string,
    environment: 'test_mode' | 'live_mode',
  ): Promise<DodoPayments> {
    if (
      !this.client ||
      this.cachedApiKey !== apiKey ||
      this.cachedEnvironment !== environment
    ) {
      const { default: DodoPaymentsClient } = await import('dodopayments')
      this.client = new DodoPaymentsClient({ bearerToken: apiKey, environment })
      this.cachedApiKey = apiKey
      this.cachedEnvironment = environment
    }
    return this.client
  }

  async createCheckout(input: {
    reader: { id: string; email?: string | null; name?: string | null }
    plan: MembershipPlan
    returnUrl?: string
  }): Promise<{ checkoutUrl: string }> {
    const membershipConfig = await this.configsService.get('membership')
    const productId =
      input.plan === 'monthly'
        ? membershipConfig.monthlyProductId
        : membershipConfig.yearlyProductId

    if (!productId) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    if (!membershipConfig.apiKey) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    const client = await this.getClient(
      membershipConfig.apiKey,
      membershipConfig.environment,
    )

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      metadata: { readerId: input.reader.id, plan: input.plan },
      customer: input.reader.email
        ? { email: input.reader.email, name: input.reader.name ?? undefined }
        : undefined,
      return_url: input.returnUrl,
    })

    if (!session.checkout_url) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    return { checkoutUrl: session.checkout_url }
  }

  async getPlanPricing(
    productId: string,
  ): Promise<NormalizedPlanPricing | null> {
    const cached = this.pricingCache.get(productId)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    const membershipConfig = await this.configsService.get('membership')
    if (!membershipConfig.apiKey) return null

    const client = await this.getClient(
      membershipConfig.apiKey,
      membershipConfig.environment,
    )

    let value: NormalizedPlanPricing | null = null
    try {
      const product = await client.products.retrieve(productId)
      const price = product.price as
        | {
            price?: number
            currency?: string
            payment_frequency_interval?: unknown
            payment_frequency_count?: number
          }
        | undefined
      const interval = normalizeInterval(price?.payment_frequency_interval)
      if (
        price &&
        typeof price.price === 'number' &&
        price.currency &&
        interval
      ) {
        value = {
          amount: price.price,
          currency: price.currency,
          interval,
          intervalCount: price.payment_frequency_count ?? 1,
        }
      }
    } catch {
      value = null
    }

    this.pricingCache.set(productId, {
      value,
      expiresAt: Date.now() + PRICING_TTL_MS,
    })
    return value
  }

  async verifyAndParseWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): Promise<BillingWebhookResult> {
    const membershipConfig = await this.configsService.get('membership')
    if (!membershipConfig.webhookSigningKey) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    const payload =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    const webhook = new Webhook(membershipConfig.webhookSigningKey)

    let event: DodoSubscriptionEvent
    try {
      event = webhook.verify(payload, headers) as DodoSubscriptionEvent
    } catch (error) {
      this.logger.warn(
        `Webhook signature verification failed for ${headers['webhook-id']}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      throw createAppException(AppErrorCode.WEBHOOK_SIGNATURE_INVALID)
    }

    const type = resolveEventType(event)
    if (!type) {
      this.logger.log(
        `Ignoring unsupported Dodo event ${event.type}${
          event.data?.status ? ` (status: ${event.data.status})` : ''
        }`,
      )
      return { ignored: true, rawType: event.type, reason: 'unsupported_event' }
    }

    const readerId = event.data.metadata?.readerId
    if (!readerId) {
      this.logger.warn(
        `Ignoring Dodo event ${event.type} for subscription ${event.data.subscription_id}: metadata.readerId is missing`,
      )
      return {
        ignored: true,
        rawType: event.type,
        reason: 'missing_reader_metadata',
      }
    }

    return {
      event: {
        eventId: headers['webhook-id'],
        provider: 'dodo',
        type,
        customerId: event.data.customer.customer_id,
        subscriptionId: event.data.subscription_id,
        plan: planFromEvent(event),
        currentPeriodEnd: new Date(event.data.next_billing_date),
        readerId,
      },
      rawType: event.type,
      rawPayload: event,
    }
  }
}
