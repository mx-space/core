import {
  COMMENT_CREATED_EVENT,
  type CommentCreatedEvent,
  PUSH_SIGNATURE_HEADERS,
  RelayClaimResponseSchema,
  signPushRequest,
  sourceAuthorization,
} from '@mx-space/push-protocol'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { PushRepository } from './push.repository'
import type { PushActivationRequestDto } from './push.schema'
import { resolveAllowedPushRelayOrigin } from './push-relay-origin'
import { PushSecretVault } from './push-secret.vault'

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name)
  private listenerDisposer?: IEventManagerHandlerDisposer
  private dispatching = false

  constructor(
    private readonly repository: PushRepository,
    private readonly configs: ConfigsService,
    private readonly events: EventManagerService,
  ) {}

  onModuleInit() {
    this.listenerDisposer = this.events.registerHandler(
      (event: BusinessEvents, data, scope) => {
        if (event !== BusinessEvents.COMMENT_CREATE) return
        if ((scope & EventScope.TO_ADMIN) === 0) return
        void this.enqueueComment(data).catch((error) => {
          this.logger.error(
            `Unable to enqueue comment push: ${error instanceof Error ? error.message : String(error)}`,
          )
        })
      },
    )
  }

  onModuleDestroy() {
    this.listenerDisposer?.()
  }

  async activate(ownerId: string, input: PushActivationRequestDto) {
    PushSecretVault.assertConfigured()
    const relayUrl = resolveAllowedPushRelayOrigin(input.relayUrl)
    const existing = await this.repository.findSourceByRelayUrl(relayUrl)
    const sourceOrigin = await this.sourceOrigin()
    const response = await fetch(`${relayUrl}/v1/source-activations/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(existing
          ? {
              authorization: sourceAuthorization(
                existing.remoteSourceId,
                PushSecretVault.decrypt(existing.sourceSecret),
              ),
            }
          : {}),
      },
      body: JSON.stringify({
        ticket: input.activationTicket,
        source_origin: sourceOrigin,
        source_label: new URL(sourceOrigin).hostname,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new Error(
        `Push Relay activation failed with HTTP ${response.status}`,
      )
    }
    const claim = RelayClaimResponseSchema.parse(await response.json())
    if (!existing && !claim.source_secret) {
      throw new Error('Push Relay did not return the first source secret')
    }
    const eventEndpoint = new URL(claim.event_endpoint)
    if (
      eventEndpoint.origin !== relayUrl ||
      eventEndpoint.pathname !== '/v1/webhooks/mx-core' ||
      eventEndpoint.search ||
      eventEndpoint.hash
    ) {
      throw new Error('Push Relay returned an untrusted event endpoint')
    }

    const binding = await this.repository.saveActivation({
      ownerId,
      relayUrl,
      remoteSourceId: claim.source_id,
      sourceSecret: claim.source_secret
        ? PushSecretVault.encrypt(claim.source_secret)
        : null,
      eventEndpoint: eventEndpoint.toString(),
      remoteBindingId: claim.binding_id,
      installationId: claim.installation_id,
    })
    return { enabled: true as const, relayUrl, bindingId: binding.id }
  }

  async status(ownerId: string) {
    const [binding, source] = await Promise.all([
      this.repository.findActiveBinding(ownerId),
      this.repository.findLatestSourceForOwner(ownerId),
    ])
    return {
      configured: source !== null,
      enabled: binding !== null,
      relayUrl: binding?.relayUrl ?? source?.relayUrl ?? null,
      bindingId: binding?.id ?? null,
    }
  }

  async deactivate(ownerId: string, bindingId: string) {
    const binding = await this.repository.findActiveBinding(ownerId)
    if (!binding || binding.id !== bindingId) return
    const relayUrl = resolveAllowedPushRelayOrigin(binding.source.relayUrl)
    const response = await fetch(
      `${relayUrl}/v1/bindings/${encodeURIComponent(binding.remoteBindingId)}`,
      {
        method: 'DELETE',
        headers: {
          authorization: sourceAuthorization(
            binding.source.remoteSourceId,
            PushSecretVault.decrypt(binding.source.sourceSecret),
          ),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Push Relay deactivation failed with HTTP ${response.status}`,
      )
    }
    await this.repository.revokeBinding(ownerId, bindingId)
  }

  private async sourceOrigin() {
    const urls = await this.configs.get('url')
    const raw = urls.serverUrl || urls.webUrl
    if (!raw)
      throw new Error('Configure the public server URL before enabling push')
    return new URL(raw).origin
  }

  private async enqueueComment(data: unknown) {
    const comment = data as {
      id?: unknown
      createdAt?: unknown
      isOwnerReply?: unknown
    }
    if (comment.isOwnerReply === true) return
    const resourceId = String(comment.id ?? '')
    if (!resourceId || resourceId === 'undefined') return
    const rawTime = comment.createdAt
    const parsedTime =
      rawTime instanceof Date ? rawTime : new Date(String(rawTime ?? ''))
    const time = Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime
    const sources = await this.repository.listEnabledSources()
    for (const source of sources) {
      const event: CommentCreatedEvent = {
        specversion: '1.0',
        id: `comment.created:${resourceId}`,
        source: `urn:mx-core:instance:${source.remoteSourceId}`,
        type: COMMENT_CREATED_EVENT,
        subject: `comment/${resourceId}`,
        time: time.toISOString(),
        datacontenttype: 'application/json',
        data: { resource_id: resourceId, resource_type: 'comment' },
      }
      await this.repository.enqueueDelivery({
        sourceId: source.id,
        event,
        now: new Date(),
      })
    }
    void this.dispatchDue()
  }

  @Interval(15_000)
  async dispatchDue() {
    if (this.dispatching) return
    this.dispatching = true
    try {
      const deliveries = await this.repository.claimDueDeliveries(new Date())
      await Promise.all(deliveries.map((delivery) => this.dispatch(delivery)))
    } finally {
      this.dispatching = false
    }
  }

  private async dispatch(
    delivery: Awaited<ReturnType<PushRepository['claimDueDeliveries']>>[number],
  ) {
    const body = JSON.stringify(delivery.event)
    const timestamp = String(Date.now())
    const secret = PushSecretVault.decrypt(delivery.source.sourceSecret)
    const signature = signPushRequest({
      secret,
      timestamp,
      deliveryId: delivery.id,
      rawBody: body,
    })
    try {
      const relayUrl = resolveAllowedPushRelayOrigin(delivery.source.relayUrl)
      const eventEndpoint = new URL(delivery.source.eventEndpoint)
      if (
        eventEndpoint.origin !== relayUrl ||
        eventEndpoint.pathname !== '/v1/webhooks/mx-core' ||
        eventEndpoint.search ||
        eventEndpoint.hash
      ) {
        throw new Error('Stored Push Relay event endpoint is not trusted')
      }
      const response = await fetch(eventEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/cloudevents+json',
          [PUSH_SIGNATURE_HEADERS.source]: delivery.source.remoteSourceId,
          [PUSH_SIGNATURE_HEADERS.delivery]: delivery.id,
          [PUSH_SIGNATURE_HEADERS.timestamp]: timestamp,
          [PUSH_SIGNATURE_HEADERS.signature]: signature,
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) {
        await this.repository.markDelivered(delivery.id, new Date())
        return
      }
      await this.handleDispatchFailure(
        delivery.id,
        delivery.attempt,
        `HTTP ${response.status}`,
      )
    } catch (error) {
      await this.handleDispatchFailure(
        delivery.id,
        delivery.attempt,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async handleDispatchFailure(
    id: string,
    attempt: number,
    error: string,
  ) {
    const now = new Date()
    if (attempt >= 8) {
      await this.repository.markFailed(id, error.slice(0, 1_000), now)
      return
    }
    const delaySeconds = Math.min(2 ** attempt * 15, 60 * 60)
    await this.repository.markRetry(
      id,
      error.slice(0, 1_000),
      new Date(now.getTime() + delaySeconds * 1000),
      now,
    )
  }
}
