import { createHmac } from 'node:crypto'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { PagerDto } from '~/shared/dto/pager.dto'
import { InjectModel } from '~/transformers/model.transformer'
import { WebhookEventModel } from './webhook-event.model'
import { WebhookModel } from './webhook.model'

const ACCEPT_EVENTS = new Set(Object.values(BusinessEvents))

@Injectable()
export class WebhookService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel(WebhookModel)
    private readonly webhookModel: ReturnModelType<typeof WebhookModel>,
    @InjectModel(WebhookEventModel)
    private readonly webhookEventModel: MongooseModel<WebhookEventModel>,
    private readonly httpService: HttpService,
    private readonly eventService: EventManagerService,
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

  async sendWebhook(event: string, payload: any, scope: EventScope) {
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
      return (EventScope.ALL & scope) === scope
    })

    await Promise.all(
      scopedWebhooks.map((webhook) => {
        return this.sendWebhookEvent(event, payload, webhook)
      }),
    )
  }

  private async sendWebhookEvent(
    event: string,
    payload: object,
    webhook: WebhookModel,
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
    }
    const webhookEvent = await this.webhookEventModel.create({
      event,
      headers,
      success: false,
      payload: stringifyPayload,
      hookId: webhook.id,
      response: null,
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
      throw new BadRequestException('Webhook event not found')
    }
    const hook = await this.webhookModel.findById(record.hookId)
    if (!hook) {
      throw new BadRequestException('Webhook not found')
    }
    const scope = hook.scope

    await this.sendWebhook(record.event, JSON.parse(record.payload), scope)
  }

  async getEventsByHookId(hookId: string, query: PagerDto) {
    const { page, size } = query
    const skip = (page - 1) * size

    return await this.webhookEventModel.paginate(
      {
        hookId,
      },
      {
        limit: size,
        skip,
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
