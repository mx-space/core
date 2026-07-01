import { createHmac } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { EventPayloadEnricherService } from '~/processors/helper/helper.event-payload.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { BasicPagerInput } from '~/shared/dto/pager.dto'
import { isPrivateIp } from '~/utils/ssrf.util'

import { WebhookRepository } from './webhook.repository'
import type { WebhookRow } from './webhook.types'
import { WebhookModel } from './webhook.types'

const ACCEPT_EVENTS = new Set(Object.values(BusinessEvents))

type WebhookEventSource = 'admin' | 'visitor' | 'system'

function scopeToSource(scope: EventScope): WebhookEventSource {
  const hasVisitor = (scope & EventScope.TO_VISITOR) !== 0
  const hasAdmin = (scope & EventScope.TO_ADMIN) !== 0

  if (hasVisitor) return 'admin'
  if (hasAdmin) return 'visitor'
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
    await this.assertWebhookUrlAllowed(model.payloadUrl)
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

  // Best-effort early rejection of obviously-internal targets. The real gate is
  // the delivery-time check in `sendWebhookEvent`, since DNS can change/rebind
  // between persistence and dispatch.
  private async assertWebhookUrlAllowed(payloadUrl: string) {
    try {
      await assertWebhookTargetIsPublic(payloadUrl)
    } catch (error: any) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: error?.message ?? 'Webhook URL is not allowed',
      })
    }
  }

  transformEvents(events: string[]) {
    if (events.includes('all')) return ['all']
    return events.filter((event) => ACCEPT_EVENTS.has(event as any))
  }

  async deleteWebhook(id: string) {
    await this.webhookRepository.deleteById(id)
    await this.webhookRepository.deleteEventsByHookId(id)
  }

  async updateWebhook(id: string, model: Partial<WebhookModel>) {
    if (model.payloadUrl !== undefined) {
      await this.assertWebhookUrlAllowed(model.payloadUrl)
    }
    await this.webhookRepository.update(id, model)
    const document = await this.webhookRepository.findById(id)
    if (document)
      return await this.sendWebhookEvent('health_check', {}, document)
  }

  getAllWebhooks() {
    return this.webhookRepository.findAll()
  }

  async sendWebhook(event: string, rawPayload: any, scope: EventScope) {
    const scopedWebhooks = (await this.webhookRepository.findEnabled()).filter(
      (webhook) =>
        webhook.events.some((item) => item === event || item === 'all') &&
        webhook.scope &&
        (webhook.scope & scope) !== 0,
    )

    if (scopedWebhooks.length === 0) return

    const payload = await this.enricher.enrichPayload(
      event as BusinessEvents,
      rawPayload,
    )
    const source = scopeToSource(scope)

    await Promise.all(
      scopedWebhooks.map((webhook) =>
        this.sendWebhookEvent(event, payload, webhook, source),
      ),
    )
  }

  private async sendWebhookEvent(
    event: string,
    payload: object,
    webhook: WebhookRow & { secret: string },
    source: WebhookEventSource = 'system',
  ) {
    // One stringify for HMAC signing; the dispatched body is parsed back from
    // that same string so the signed bytes and the sent body never diverge, and
    // a non-cloneable value can never throw here.
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
    try {
      await assertWebhookTargetIsPublic(webhook.payloadUrl)
    } catch (error: any) {
      await this.webhookRepository.updateEvent(webhookEvent.id, {
        response: {
          error: 'SSRF_BLOCKED',
          message: error?.message ?? 'Webhook target rejected',
          timestamp: Date.now(),
        },
        status: 0,
        success: false,
      })
      return
    }
    try {
      const response = await this.httpService.fetch.raw(webhook.payloadUrl, {
        method: 'POST',
        body: clonedPayload,
        headers,
        redirect: 'error',
        retry: 10,
      })
      await this.webhookRepository.updateEvent(webhookEvent.id, {
        response: {
          headers: Object.fromEntries(response.headers.entries()),
          data: response._data,
          timestamp: Date.now(),
        },
        status: response.status,
        success: true,
      })
    } catch (error: any) {
      const errResponse = error?.response
      if (!errResponse) {
        return
      }
      this.webhookRepository.updateEvent(webhookEvent.id, {
        response: {
          headers: Object.fromEntries(errResponse.headers.entries()),
          data: errResponse._data ?? error.data,
          timestamp: Date.now(),
        },
        status: errResponse.status,
        success: false,
      })
    }
  }

  async redispatch(id: string) {
    const record = await this.webhookRepository.findEventById(id)
    if (!record) {
      throw createAppException(AppErrorCode.WEBHOOK_EVENT_NOT_FOUND, { id })
    }
    const hook = await this.webhookRepository.findById(record.hookId)
    if (!hook) {
      throw createAppException(AppErrorCode.WEBHOOK_NOT_FOUND, {
        id: record.hookId,
      })
    }

    await this.sendWebhookEvent(
      record.event ?? 'unknown',
      typeof record.payload === 'string'
        ? JSON.parse(record.payload)
        : (record.payload as object),
      hook,
    )
  }

  async getEventsByHookId(hookId: string, query: BasicPagerInput) {
    const { page, size } = query
    return this.webhookRepository.listEvents(hookId, page, size)
  }

  clearDispatchEvents(hookId: string) {
    return this.webhookRepository.deleteEventsByHookId(hookId)
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

class WebhookTargetRejectedError extends Error {}

// Range checks delegate to the shared SSRF guard (url-guard.ts) so the blocked
// CIDR list has a single source of truth across webhook / link-avatar / agent-browser.
function isBlockedIP(rawIp: string): boolean {
  const zoneIdx = rawIp.indexOf('%')
  const ip = zoneIdx === -1 ? rawIp : rawIp.slice(0, zoneIdx)
  const family = isIP(ip)
  if (family === 0) return true
  return isPrivateIp(ip, family)
}

/**
 * SSRF guard. Validates protocol and resolves the hostname, rejecting any
 * webhook target that points at loopback / link-local / private / metadata
 * addresses. Returns the resolved IP that the request will actually hit.
 *
 * NOTE: this is checked at delivery time (the real gate). A DNS-rebinding
 * attacker can still pass this check and then re-point the hostname before the
 * HTTP socket connects; `maxRedirects: 0` removes the redirect-based bypass but
 * not rebinding. Pinning the connection to `resolvedIp` would be needed to
 * fully close that window.
 */
async function assertWebhookTargetIsPublic(rawUrl: string): Promise<string> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new WebhookTargetRejectedError(`Invalid webhook URL: ${rawUrl}`)
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new WebhookTargetRejectedError(
      `Webhook protocol not allowed: ${url.protocol}`,
    )
  }
  let hostname = url.hostname
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1)
  }

  // Hostname is already a literal IP — validate directly.
  if (isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new WebhookTargetRejectedError(
        `Webhook target resolves to a blocked address: ${hostname}`,
      )
    }
    return hostname
  }

  if (hostname.toLowerCase() === 'localhost') {
    throw new WebhookTargetRejectedError('Webhook target localhost is blocked')
  }

  let resolved: { address: string }[]
  try {
    resolved = await dnsLookup(hostname, { all: true })
  } catch {
    throw new WebhookTargetRejectedError(
      `Webhook target hostname could not be resolved: ${hostname}`,
    )
  }
  if (resolved.length === 0) {
    throw new WebhookTargetRejectedError(
      `Webhook target hostname did not resolve: ${hostname}`,
    )
  }
  for (const { address } of resolved) {
    if (isBlockedIP(address)) {
      throw new WebhookTargetRejectedError(
        `Webhook target resolves to a blocked address: ${address}`,
      )
    }
  }
  return resolved[0].address
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
