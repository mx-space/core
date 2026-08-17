import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  type CommentCreatedEvent,
  type CommentRepliedEvent,
  CONTENT_PUBLISHED_EVENT,
  type ContentPublishedEvent,
  PUSH_SIGNATURE_HEADERS,
  type PushEvent,
  type PushPreferences,
  RelayClaimResponseSchema,
  signPushRequest,
  sourceAuthorization,
} from '@mx-space/push-protocol'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { PushRepository } from './push.repository'
import type { PushActivationRequestDto } from './push.schema'
import type {
  PushReaderPreferences,
  PushRelayBindingRow,
  PushRelaySourceRow,
} from './push.types'
import { resolveAllowedPushRelayOrigin } from './push-relay-origin'
import { PushSecretVault } from './push-secret.vault'

const toRelayPreferences = (
  preferences: PushReaderPreferences,
): PushPreferences => ({
  content_post: preferences.contentPost,
  content_note: preferences.contentNote,
  content_recently: preferences.contentRecently,
  comment_replied: preferences.commentReplied,
})

const resourceIdOf = (data: unknown) => {
  const value = (data as { id?: unknown } | null)?.id
  const resourceId = String(value ?? '')
  return resourceId && resourceId !== 'undefined' ? resourceId : null
}

const eventTimeOf = (data: unknown) => {
  const rawTime = (data as { createdAt?: unknown } | null)?.createdAt
  const parsedTime =
    rawTime instanceof Date ? rawTime : new Date(String(rawTime ?? ''))
  return Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime
}

const safePreferenceSyncReason = (reason: unknown) => {
  const raw = reason instanceof Error ? reason.message : String(reason)
  return raw.replaceAll(/\s+/g, ' ').slice(0, 200)
}

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name)
  private listenerDisposer?: IEventManagerHandlerDisposer
  private dispatching = false

  constructor(
    private readonly repository: PushRepository,
    private readonly configs: ConfigsService,
    private readonly events: EventManagerService,
    private readonly comments: CommentRepository,
  ) {}

  onModuleInit() {
    this.listenerDisposer = this.events.registerHandler(
      (event: BusinessEvents, data, scope) => {
        void this.handleBusinessEvent(event, data, scope).catch((error) => {
          this.logger.error(
            `Unable to enqueue push event: ${error instanceof Error ? error.message : String(error)}`,
          )
        })
      },
    )
  }

  onModuleDestroy() {
    this.listenerDisposer?.()
  }

  async activate(readerId: string, input: PushActivationRequestDto) {
    PushSecretVault.assertConfigured()
    const relayUrl = resolveAllowedPushRelayOrigin(input.relayUrl)
    const existing = await this.repository.findSourceByRelayUrl(relayUrl)
    const sourceOrigin = await this.sourceOrigin()
    const preferences = await this.repository.getOrDefaultPreferences(readerId)
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
        reader_id: readerId,
        preferences: toRelayPreferences(preferences),
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
      readerId,
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

  async status(readerId: string) {
    const [binding, source] = await Promise.all([
      this.repository.findActiveBinding(readerId),
      this.repository.findLatestSourceForReader(readerId),
    ])
    return {
      configured: source !== null,
      enabled: binding !== null,
      relayUrl: binding?.relayUrl ?? source?.relayUrl ?? null,
      bindingId: binding?.id ?? null,
    }
  }

  async getPreferences(readerId: string) {
    return this.repository.getOrDefaultPreferences(readerId)
  }

  async updatePreferences(
    readerId: string,
    patch: Partial<PushReaderPreferences>,
  ) {
    const current = await this.repository.getOrDefaultPreferences(readerId)
    const next = { ...current, ...patch }
    await this.repository.upsertPreferences(readerId, next)
    const bindings = await this.repository.listActiveBindingsForReader(readerId)
    const results = await Promise.allSettled(
      bindings.map((binding) => this.syncRemotePreferences(binding, next)),
    )
    const failed = results.flatMap((result, index) => {
      if (result.status !== 'rejected') return []
      const binding = bindings[index]
      if (!binding) return []
      return [`${binding.id}: ${safePreferenceSyncReason(result.reason)}`]
    })
    if (failed.length > 0) {
      throw new Error(
        `Push Relay preferences sync failed for ${failed.join('; ')}`,
      )
    }
    return next
  }

  async deactivate(readerId: string, bindingId: string) {
    const binding = await this.repository.findOwnedActiveBinding(
      readerId,
      bindingId,
    )
    if (!binding?.source) return
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
    await this.repository.revokeBinding(readerId, bindingId)
  }

  private async sourceOrigin() {
    const urls = await this.configs.get('url')
    const raw = urls.serverUrl || urls.webUrl
    if (!raw)
      throw new Error('Configure the public server URL before enabling push')
    return new URL(raw).origin
  }

  private async handleBusinessEvent(
    event: BusinessEvents,
    data: unknown,
    scope: EventScope,
  ) {
    if (event === BusinessEvents.COMMENT_CREATE) {
      if ((scope & EventScope.TO_ADMIN) !== 0) {
        await this.enqueueCommentCreated(data)
      }
      if ((scope & EventScope.TO_VISITOR) !== 0) {
        await this.enqueueCommentReplied(data)
      }
      return
    }

    if ((scope & EventScope.TO_VISITOR) === 0) return
    if (event === BusinessEvents.POST_CREATE) {
      await this.enqueueContentPublished(data, 'post')
      return
    }
    if (event === BusinessEvents.NOTE_CREATE) {
      await this.enqueueContentPublished(data, 'note')
      return
    }
    if (event === BusinessEvents.RECENTLY_CREATE) {
      await this.enqueueContentPublished(data, 'recently')
    }
  }

  private async enqueueCommentCreated(data: unknown) {
    const comment = data as {
      id?: unknown
      createdAt?: unknown
      isOwnerReply?: unknown
    }
    if (comment.isOwnerReply === true) return
    const resourceId = resourceIdOf(comment)
    if (!resourceId) return
    const time = eventTimeOf(comment)
    await this.enqueueToEnabledSources((source) => {
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
      return event
    })
  }

  private async enqueueCommentReplied(data: unknown) {
    const comment = data as {
      id?: unknown
      createdAt?: unknown
      parentCommentId?: unknown
      readerId?: unknown
    }
    const resourceId = resourceIdOf(comment)
    const parentCommentId = comment.parentCommentId
    if (!resourceId || parentCommentId == null || parentCommentId === '') return
    const parent = await this.comments.findById(String(parentCommentId))
    const recipientReaderId = parent?.readerId
    if (!recipientReaderId) return
    if (recipientReaderId === String(comment.readerId ?? '')) return
    const time = eventTimeOf(comment)
    await this.enqueueToEnabledSources((source) => {
      const event: CommentRepliedEvent = {
        specversion: '1.0',
        id: `comment.replied:${resourceId}`,
        source: `urn:mx-core:instance:${source.remoteSourceId}`,
        type: COMMENT_REPLIED_EVENT,
        subject: `comment/${resourceId}`,
        time: time.toISOString(),
        datacontenttype: 'application/json',
        data: {
          resource_id: resourceId,
          resource_type: 'comment',
          recipient_reader_id: recipientReaderId,
        },
      }
      return event
    })
  }

  private async enqueueContentPublished(
    data: unknown,
    resourceType: ContentPublishedEvent['data']['resource_type'],
  ) {
    const resourceId = resourceIdOf(data)
    if (!resourceId) return
    const time = eventTimeOf(data)
    await this.enqueueToEnabledSources((source) => {
      const event: ContentPublishedEvent = {
        specversion: '1.0',
        id: `content.published:${resourceType}:${resourceId}`,
        source: `urn:mx-core:instance:${source.remoteSourceId}`,
        type: CONTENT_PUBLISHED_EVENT,
        subject: `${resourceType}/${resourceId}`,
        time: time.toISOString(),
        datacontenttype: 'application/json',
        data: { resource_id: resourceId, resource_type: resourceType },
      }
      return event
    })
  }

  private async enqueueToEnabledSources(
    buildEvent: (source: PushRelaySourceRow) => PushEvent,
  ) {
    const sources = await this.repository.listEnabledSources()
    const now = new Date()
    for (const source of sources) {
      await this.repository.enqueueDelivery({
        sourceId: source.id,
        event: buildEvent(source),
        now,
      })
    }
    void this.dispatchDue()
  }

  private async syncRemotePreferences(
    binding: PushRelayBindingRow,
    preferences: PushReaderPreferences,
  ) {
    if (!binding.source) {
      throw new Error('Push binding is missing source credentials')
    }
    const relayUrl = resolveAllowedPushRelayOrigin(binding.source.relayUrl)
    const response = await fetch(
      `${relayUrl}/v1/bindings/${encodeURIComponent(binding.remoteBindingId)}/preferences`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: sourceAuthorization(
            binding.source.remoteSourceId,
            PushSecretVault.decrypt(binding.source.sourceSecret),
          ),
        },
        body: JSON.stringify(toRelayPreferences(preferences)),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) {
      throw new Error(
        `Push Relay preference update failed with HTTP ${response.status}`,
      )
    }
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
