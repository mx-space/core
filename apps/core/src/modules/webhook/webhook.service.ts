import { createHmac } from 'node:crypto'

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { EventPayloadEnricherService } from '~/processors/helper/helper.event-payload.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { PagerDto } from '~/shared/dto/pager.dto'

import { WebhookModel } from './webhook.model'
import { WebhookRepository, type WebhookRow } from './webhook.repository'

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
    private readonly webhookRepository: WebhookRepository,
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
    const document = await this.webhookRepository.create({
      payloadUrl: model.payloadUrl,
      events: model.events,
      secret: model.secret,
      enabled: model.enabled,
      scope: model.scope,
    })
    return await this.sendWebhookEvent(
      'health_check',
      {},
      {
        ...document,
        secret: model.secret,
      },
    )
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
    await this.webhookRepository.deleteById(id)
    await this.webhookRepository.deleteEventsByHookId(id)
  }

  async updateWebhook(id: string, model: Partial<WebhookModel>) {
    await this.webhookRepository.update(id, model)
    const document = await this.webhookRepository.findById(id)
    if (document)
      return await this.sendWebhookEvent('health_check', {}, document)
  }

  getAllWebhooks() {
    return this.webhookRepository.findAll()
  }

  async sendWebhook(event: string, rawPayload: any, scope: EventScope) {
    const enabledWebHooks = (await this.webhookRepository.findEnabled()).filter(
      (webhook) =>
        webhook.events.some((item) => item === event || item === 'all'),
    )

    const scopedWebhooks: Array<WebhookRow & { secret: string }> = []
    for (const webhook of enabledWebHooks) {
      if (!webhook.scope) {
        continue
      }
      if ((webhook.scope & scope) !== 0) {
        scopedWebhooks.push(webhook)
      }
    }

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
    webhook: WebhookRow & { secret: string },
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
    const webhookEvent = await this.webhookRepository.logEvent({
      event,
      headers,
      success: false,
      payload: clonedPayload,
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
        await this.webhookRepository.updateEvent(webhookEvent.id, {
          response: {
            headers: response.headers,
            data: response.data,
            timestamp: Date.now(),
          },
          status: response.status,
          success: true,
        })
      })
      .catch((error) => {
        if (!error.response) {
          return
        }
        this.webhookRepository.updateEvent(webhookEvent.id, {
          response: {
            headers: error.response.headers,
            data: error.response.data,
            timestamp: Date.now(),
          },
          status: error.response.status,
          success: false,
        })
      })
  }

  async redispatch(id: string) {
    const record = await this.webhookRepository.findEventById(id)
    if (!record) {
      throw new BizException(ErrorCodeEnum.WebhookEventNotFound)
    }
    const hook = await this.webhookRepository.findById(record.hookId)
    if (!hook) {
      throw new BizException(ErrorCodeEnum.WebhookNotFound)
    }

    await this.sendWebhookEvent(
      record.event ?? 'unknown',
      typeof record.payload === 'string'
        ? JSON.parse(record.payload)
        : (record.payload as object),
      hook,
    )
  }

  async getEventsByHookId(hookId: string, query: PagerDto) {
    const { page, size } = query

    const result = await this.webhookRepository.listEvents(hookId, page, size)
    return {
      docs: result.data,
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }

  clearDispatchEvents(hookId: string) {
    return this.webhookRepository.deleteEventsByHookId(hookId)
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
