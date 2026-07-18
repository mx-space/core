import { Injectable } from '@nestjs/common'
import DodoPayments from 'dodopayments'
import { Webhook } from 'standardwebhooks'

import { MEMBERSHIP } from '~/app.config'
import { AppErrorCode, createAppException } from '~/common/errors'

import { ConfigsService } from '../../configs/configs.service'
import type { MembershipPlan } from '../membership.types'
import type {
  NormalizedBillingEvent,
  PaymentProviderAdapter,
} from './provider.interface'

type DodoSubscriptionEvent = {
  type:
    | 'subscription.active'
    | 'subscription.renewed'
    | 'subscription.on_hold'
    | 'subscription.cancelled'
    | 'subscription.expired'
    | 'subscription.plan_changed'
  business_id: string
  timestamp: string
  data: {
    subscription_id: string
    customer: { customer_id: string }
    metadata?: Record<string, string>
    next_billing_date: string
    payment_frequency_interval?: 'Day' | 'Week' | 'Month' | 'Year'
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
  'subscription.plan_changed': 'plan_changed',
}

const planFromInterval = (
  interval: DodoSubscriptionEvent['data']['payment_frequency_interval'],
): MembershipPlan | undefined => {
  if (interval === 'Month') return 'monthly'
  if (interval === 'Year') return 'yearly'
  return undefined
}

@Injectable()
export class DodoProvider implements PaymentProviderAdapter {
  private client: DodoPayments | null = null

  constructor(private readonly configsService: ConfigsService) {}

  private getClient(): DodoPayments {
    if (!MEMBERSHIP.dodoApiKey) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }
    this.client ??= new DodoPayments({ bearerToken: MEMBERSHIP.dodoApiKey })
    return this.client
  }

  async createCheckout(input: {
    reader: { id: string; email?: string | null; name?: string | null }
    plan: MembershipPlan
  }): Promise<{ checkoutUrl: string }> {
    const membershipConfig = await this.configsService.get('membership')
    const productId =
      input.plan === 'monthly'
        ? membershipConfig.monthlyProductId
        : membershipConfig.yearlyProductId

    if (!productId) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    const session = await this.getClient().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      metadata: { readerId: input.reader.id },
      customer: input.reader.email
        ? { email: input.reader.email, name: input.reader.name ?? undefined }
        : undefined,
    })

    if (!session.checkout_url) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    return { checkoutUrl: session.checkout_url }
  }

  async verifyAndParseWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): Promise<NormalizedBillingEvent> {
    if (!MEMBERSHIP.dodoWebhookKey) {
      throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
    }

    const payload =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    const webhook = new Webhook(MEMBERSHIP.dodoWebhookKey)

    let event: DodoSubscriptionEvent
    try {
      event = webhook.verify(payload, headers) as DodoSubscriptionEvent
    } catch {
      throw createAppException(AppErrorCode.WEBHOOK_VERIFY_FAILED)
    }

    const type = DODO_EVENT_TYPE_MAP[event.type]
    if (!type) {
      throw createAppException(AppErrorCode.WEBHOOK_VERIFY_FAILED)
    }

    const readerId = event.data.metadata?.readerId
    if (!readerId) {
      throw createAppException(AppErrorCode.WEBHOOK_VERIFY_FAILED)
    }

    return {
      eventId: headers['webhook-id'],
      provider: 'dodo',
      type,
      customerId: event.data.customer.customer_id,
      subscriptionId: event.data.subscription_id,
      plan: planFromInterval(event.data.payment_frequency_interval),
      currentPeriodEnd: new Date(event.data.next_billing_date),
      readerId,
    }
  }
}
