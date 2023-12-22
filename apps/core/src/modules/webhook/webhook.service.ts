import { createHmac } from 'crypto'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'

import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
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
    private readonly webhookEventModel: ReturnModelType<
      typeof WebhookEventModel
    >,
    private readonly httpService: HttpService,
    private readonly eventService: EventManagerService,
  ) {}

  private eventListenerDisposer: IEventManagerHandlerDisposer
  onModuleDestroy() {
    this.eventListenerDisposer()
  }

  onModuleInit() {
    this.eventListenerDisposer = this.eventService.registerHandler(
      (type: BusinessEvents, data) => {
        if (!ACCEPT_EVENTS.has(type)) {
          return
        }
        this.sendWebhook(type, data)
      },
    )
  }

  createWebhook(model: WebhookModel) {
    return this.webhookModel.create(model)
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
  }

  async getAllWebhooks() {
    return this.webhookModel.find().lean()
  }

  async sendWebhook(event: string, payload: any) {
    const stringifyPayload = JSON.stringify(payload)
    const clonedPayload = JSON.parse(stringifyPayload)
    const enabledWebHooks = await this.webhookModel
      .find({
        events: {
          $in: [event],
        },
        enabled: true,
      })
      .lean()

    await Promise.all(
      enabledWebHooks.map(async (webhook) => {
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
        this.httpService.axiosRef
          .post(webhook.payloadUrl, clonedPayload, {
            headers,
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
          .catch((err) => {
            if (!err.response) {
              return
            }
            webhookEvent.response = JSON.stringify({
              headers: err.response.headers,
              data: err.response.data,
              timestamp: Date.now(),
            })
            webhookEvent.status = err.response.status
            webhookEvent.success = false
            webhookEvent.save()
          })
      }),
    )
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
