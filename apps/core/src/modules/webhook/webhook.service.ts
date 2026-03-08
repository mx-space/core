import { createHmac } from 'node:crypto'

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { EventPayloadEnricherService } from '~/processors/helper/helper.event-payload.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'

import { WebhookModel } from './webhook.model'
import { WebhookEventModel } from './webhook-event.model'

const ACCEPT_EVENTS = new Set(Object.values(BusinessEvents))

type WebhookEventSource = 'admin' | 'visitor' | 'system'

function scopeToSource(scope: EventScope): WebhookEventSource {
  const hasVisitor = (scope & EventScope.TO_VISITOR) !== 0
  const hasAdmin = (scope & EventScope.TO_ADMIN) !== 0

  if (hasVisitor && !hasAdmin) return 'admin'
  if (hasAdmin && !hasVisitor) return 'visitor'
  if (hasVisitor && hasAdmin) return 'admin'
  return 'system'
}

@Injectable()
export class WebhookService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel(WebhookModel)
    private readonly webhookModel: ReturnModelType<typeof WebhookModel>,
    @InjectModel(WebhookEventModel)
    private readonly webhookEventModel: MongooseModel<WebhookEventModel>,
    private readonly httpService: HttpService,
    private readonly eventService: EventManagerService,
    private readonly enricher: EventPayloadEnricherService,
  ) {}

  private eventListenerDisposer: IEventManagerHandlerDisposer
  onModuleDestroy() {
    this.eventListenerDisposer()
  }

  onModuleInit() {
    this.eventListenerDisposer = this.eventService.registerHandler(
      (type: BusinessEvents, data, scope) => {
        if (!ACCEPT_EVENTS.has(type)) {
          return
        }
        this.sendWebhook(type, data, scope)
      },
    )
  }

  async createWebhook(model: WebhookModel) {
    const document = await this.webhookModel.create(model)
    return await this.sendWebhookEvent('health_check', {}, document)
  }

  transformEvents(events: string[]) {
    let nextEvents = [] as string[]
    for (const event of events) {
      if (event === 'all') {
        nextEvents = ['all']
        break
      }
      if (ACCEPT_EVENTS.has(event as any)) {
        nextEvents.push(event)
      }
    }
    return nextEvents
  }

  async deleteWebhook(id: string) {
    await this.webhookModel.deleteOne({
      _id: id,
    })
    await this.webhookEventModel.deleteMany({
      hookId: id,
    })
  }

  async updateWebhook(id: string, model: Partial<WebhookModel>) {
    await this.webhookModel.updateOne(
      {
        _id: id,
      },
      model,
    )
    const document = await this.webhookModel
      .findById(id)
      .lean()
      .select('+secret')
    if (document)
      return await this.sendWebhookEvent('health_check', {}, document)
  }

  getAllWebhooks() {
    return this.webhookModel.find().lean()
  }

  async sendWebhook(event: string, rawPayload: any, scope: EventScope) {
    const enabledWebHooks = await this.webhookModel
      .find({
        events: {
          $in: [event, 'all'],
        },
        enabled: true,
      })
      .select('+secret')
      .lean()

    const scopedWebhooks = enabledWebHooks.filter((webhook) => {
      if (typeof webhook.scope === 'undefined') {
        return true
      }
      return (webhook.scope & scope) !== 0
    })

    if (scopedWebhooks.length === 0) return

    const payload = await this.enricher.enrichPayload(
      event as BusinessEvents,
      rawPayload,
    )

    const source = scopeToSource(scope)

    await Promise.all(
      scopedWebhooks.map((webhook) => {
        return this.sendWebhookEvent(event, payload, webhook, source)
      }),
    )
  }

  private async sendWebhookEvent(
    event: string,
    payload: object,
    webhook: WebhookModel,
    source: WebhookEventSource = 'system',
  ) {
    const stringifyPayload = JSON.stringify(payload)
    const clonedPayload = JSON.parse(stringifyPayload)

    const headers = {
      'X-Webhook-Signature': generateSha1Signature(
        webhook.secret,
        stringifyPayload,
      ),
      'X-Webhook-Event': event,
      'X-Webhook-Id': webhook.id,
      'X-Webhook-Timestamp': Date.now().toString(),
      'X-Webhook-Signature256': generateSha256Signature(
        webhook.secret,
        stringifyPayload,
      ),
      'X-Webhook-Source': source,
    }
    const webhookEvent = await this.webhookEventModel.create({
      event,
      headers: dbTransforms.json(headers),
      success: false,
      payload: stringifyPayload,
      hookId: webhook.id as unknown as WebhookEventModel['hookId'],
      response: null as unknown as string,
    })
    return this.httpService.axiosRef
      .post(webhook.payloadUrl, clonedPayload, {
        headers,
        'axios-retry': {
          retries: 10,
        },
      })
      .then(async (response) => {
        webhookEvent.response = JSON.stringify({
          headers: response.headers,
          data: response.data,
          timestamp: Date.now(),
        })
        webhookEvent.status = response.status
        webhookEvent.success = true
        await webhookEvent.save()
      })
      .catch((error) => {
        if (!error.response) {
          return
        }
        webhookEvent.response = JSON.stringify({
          headers: error.response.headers,
          data: error.response.data,
          timestamp: Date.now(),
        })
        webhookEvent.status = error.response.status
        webhookEvent.success = false
        webhookEvent.save()
      })
  }

  async redispatch(id: string) {
    const record = await this.webhookEventModel.findById(id)
    if (!record) {
      throw new BizException(ErrorCodeEnum.WebhookEventNotFound)
    }
    const hook = await this.webhookModel
      .findById(record.hookId)
      .select('+secret')
      .lean()
    if (!hook) {
      throw new BizException(ErrorCodeEnum.WebhookNotFound)
    }

    await this.sendWebhookEvent(record.event, JSON.parse(record.payload), hook)
  }

  async getEventsByHookId(hookId: string, query: PagerDto) {
    const { page, size } = query

    return this.webhookEventModel.paginate(
      {
        hookId,
      },
      {
        limit: size,
        page,
        sort: {
          timestamp: -1,
        },
      },
    )
  }

  clearDispatchEvents(hookId: string) {
    return this.webhookEventModel.deleteMany({
      hookId,
    })
  }
}

function generateSha1Signature(secret: string, payload: string): string {
  const hmac = createHmac('sha1', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

function generateSha256Signature(secret: string, payload: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}
