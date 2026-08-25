import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  type CommentCreatedEvent,
  type CommentRepliedEvent,
  CONTENT_PUBLISHED_EVENT,
  type ContentPublishedEvent,
  PUSH_SIGNATURE_HEADERS,
  type PushEvent,
  RelayClaimResponseSchema,
  signPushRequest,
  sourceAuthorization,
} from '@mx-space/push-protocol'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { isString } from 'es-toolkit/compat'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { ConfigsService } from '~/modules/configs/configs.service'
import {
  DatabaseService,
  type GlobalDocumentResult,
} from '~/processors/database/database.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { OwnerService } from '../owner/owner.service'
import { PushRepository } from './push.repository'
import type { PushActivationRequestDto } from './push.schema'
import type { PushRelaySourceRow } from './push.types'
import { resolveAllowedPushRelayOrigin } from './push-relay-origin'
import { PushSecretVault } from './push-secret.vault'
import { enrichmentMapOf, projectThinkingCopy } from './recently-copy'

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

const publicText = (value: unknown, max: number) => {
  if (!isString(value)) return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, max) : null
}

const httpsUrlOf = (value: unknown) => {
  if (!isString(value)) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const isPublicPushTarget = (
  resolved: GlobalDocumentResult,
  now = new Date(),
) => {
  if (resolved.type === 'post') return resolved.document.isPublished
  if (resolved.type !== 'note') return true
  const { hasPassword, isPublished, publicAt } = resolved.document
  return (
    isPublished &&
    !hasPassword &&
    (publicAt === null || publicAt.getTime() <= now.getTime())
  )
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
    private readonly database: DatabaseService,
    private readonly owner: OwnerService,
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

  async activate(
    readerId: string | undefined,
    input: PushActivationRequestDto,
  ) {
    PushSecretVault.assertConfigured()
    const relayUrl = resolveAllowedPushRelayOrigin(input.relayUrl)
    const existing = await this.repository.findSourceByRelayUrl(relayUrl)
    const sourceOrigin = await this.sourceOrigin()
    const claimBody: Record<string, unknown> = {
      ticket: input.activationTicket,
      source_origin: sourceOrigin,
      source_label: new URL(sourceOrigin).hostname,
    }
    if (readerId) {
      claimBody.reader_id = readerId
    }
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
      body: JSON.stringify(claimBody),
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

    await this.repository.saveActivation({
      readerId: readerId ?? null,
      relayUrl,
      remoteSourceId: claim.source_id,
      sourceSecret: claim.source_secret
        ? PushSecretVault.encrypt(claim.source_secret)
        : null,
      eventEndpoint: eventEndpoint.toString(),
      remoteBindingId: claim.binding_id,
      installationId: claim.installation_id,
    })
    return {
      enabled: true as const,
      relayUrl,
      bindingId: claim.binding_id,
    }
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
      await this.enqueueRecentlyPublished(data)
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
      author?: unknown
      avatar?: unknown
      refId?: unknown
    }
    const resourceId = resourceIdOf(comment)
    const parentCommentId = comment.parentCommentId
    if (!resourceId || parentCommentId == null || parentCommentId === '') return
    const parent = await this.comments.findById(String(parentCommentId))
    const recipientReaderId = parent?.readerId
    if (!recipientReaderId) return
    if (recipientReaderId === String(comment.readerId ?? '')) return
    const targetId = resourceIdOf({ id: comment.refId })
    const senderName = publicText(comment.author, 80)
    if (!targetId || !senderName) return
    const target = await this.database.findGlobalById(targetId)
    if (!target || !isPublicPushTarget(target)) return
    const targetTitle = publicText(
      (target.document as { title?: unknown }).title ??
        (target.type === 'recently' ? 'Thinking' : null),
      160,
    )
    if (!targetTitle) return
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
          sender_id:
            publicText(comment.readerId, 128) ?? `comment:${resourceId}`,
          sender_name: senderName,
          ...(httpsUrlOf(comment.avatar)
            ? { sender_avatar_url: httpsUrlOf(comment.avatar) }
            : {}),
          target_title: targetTitle,
          target_path: `/comments/${encodeURIComponent(targetId)}`,
        },
      }
      return event
    })
  }

  private async enqueueContentPublished(
    data: unknown,
    resourceType: 'post' | 'note',
  ) {
    const resourceId = resourceIdOf(data)
    if (!resourceId) return
    const resolved = await this.database.findGlobalById(resourceId)
    if (
      !resolved ||
      resolved.type !== resourceType ||
      !isPublicPushTarget(resolved)
    ) {
      return
    }
    const document = resolved.document as {
      title?: unknown
      summary?: unknown
      slug?: unknown
      nid?: unknown
      category?: { slug?: unknown }
      metadata?: { summary?: unknown; title?: unknown } | null
    }
    const summary = publicText(
      document.summary ?? document.metadata?.summary,
      360,
    )
    const displayTitle = publicText(
      document.title ?? document.metadata?.title,
      160,
    )
    if (!displayTitle) return
    const targetPath = this.contentTargetPath(resourceType, document)
    if (!targetPath) return
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
        data: {
          resource_id: resourceId,
          resource_type: resourceType,
          display_title: displayTitle,
          ...(summary ? { summary } : {}),
          target_path: targetPath,
        },
      }
      return event
    })
  }

  private async enqueueRecentlyPublished(data: unknown) {
    const resourceId = resourceIdOf(data)
    if (!resourceId) return
    const ownerName = publicText(await this.ownerDisplayName(), 80)
    if (!ownerName) return
    const row = data as { content?: unknown; enrichments?: unknown }
    const content = typeof row.content === 'string' ? row.content : ''
    const copy = projectThinkingCopy(content, enrichmentMapOf(row.enrichments))
    if (copy.kind === 'skip') return
    const time = eventTimeOf(data)
    await this.enqueueToEnabledSources((source) => {
      const event: ContentPublishedEvent = {
        specversion: '1.0',
        id: `content.published:recently:${resourceId}`,
        source: `urn:mx-core:instance:${source.remoteSourceId}`,
        type: CONTENT_PUBLISHED_EVENT,
        subject: `recently/${resourceId}`,
        time: time.toISOString(),
        datacontenttype: 'application/json',
        data:
          copy.kind === 'enriched'
            ? {
                resource_id: resourceId,
                resource_type: 'recently',
                target_path: `/thinking/${encodeURIComponent(resourceId)}`,
                kind: 'enriched',
                owner_name: ownerName,
                verb: copy.verb,
                work_title: copy.work_title,
                ...(copy.description ? { description: copy.description } : {}),
                ...(copy.fact_creator
                  ? { fact_creator: copy.fact_creator }
                  : {}),
                ...(copy.fact_year ? { fact_year: copy.fact_year } : {}),
                ...(copy.fact_type ? { fact_type: copy.fact_type } : {}),
              }
            : {
                resource_id: resourceId,
                resource_type: 'recently',
                target_path: `/thinking/${encodeURIComponent(resourceId)}`,
                kind: 'plain',
                owner_name: ownerName,
                text: copy.text,
                ...(copy.summary ? { summary: copy.summary } : {}),
              },
      }
      return event
    })
  }

  private async ownerDisplayName() {
    try {
      return (await this.owner.getOwner()).name
    } catch {
      return null
    }
  }

  private contentTargetPath(
    resourceType: 'post' | 'note',
    document: {
      slug?: unknown
      nid?: unknown
      category?: { slug?: unknown }
    },
  ) {
    if (resourceType === 'post') {
      const category = publicText(document.category?.slug, 128)
      const slug = publicText(document.slug, 128)
      return category && slug
        ? `/posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`
        : null
    }
    if (resourceType === 'note') {
      const nid =
        typeof document.nid === 'number' || typeof document.nid === 'string'
          ? String(document.nid)
          : ''
      return nid ? `/notes/${encodeURIComponent(nid)}` : null
    }
    return null
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
