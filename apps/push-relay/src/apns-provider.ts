import { createPrivateKey, sign } from 'node:crypto'
import { connect } from 'node:http2'

import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  PUSH_PROTOCOL_VERSION,
  type PushEvent,
} from '@mx-space/push-protocol'

import type { ApnsAppConfig, ApnsKeyConfig } from './config.js'
import type { ApnsProvider, ApnsResult } from './types.js'

const base64urlJSON = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

type CachedToken = { value: string; issuedAtSeconds: number }

export class Http2ApnsProvider implements ApnsProvider {
  private readonly tokenCache = new Map<string, CachedToken>()

  constructor(private readonly apps: ReadonlyMap<string, ApnsAppConfig>) {}

  async send(input: Parameters<ApnsProvider['send']>[0]): Promise<ApnsResult> {
    const app = this.apps.get(input.appId)
    if (!app) return { status: 400, apnsId: null, reason: 'UnknownApp' }
    const key = app.keys[input.environment]
    if (!key)
      return { status: 400, apnsId: null, reason: 'MissingEnvironmentKey' }

    const host =
      input.environment === 'development'
        ? 'https://api.sandbox.push.apple.com'
        : 'https://api.push.apple.com'
    const token = this.providerToken(app, input.environment, key)
    const payload = JSON.stringify(buildApnsPayload(input.event))
    if (Buffer.byteLength(payload) > 4096) {
      return { status: 400, apnsId: null, reason: 'PayloadTooLarge' }
    }

    const session = connect(host)
    return await new Promise<ApnsResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        session.destroy(new Error('APNs request timed out'))
      }, 10_000)
      session.once('error', reject)
      const request = session.request({
        ':method': 'POST',
        ':path': `/3/device/${input.deviceToken}`,
        authorization: `bearer ${token}`,
        'apns-topic': app.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      })
      let status = 500
      let apnsId: string | null = null
      const chunks: Buffer[] = []
      request.on('response', (headers) => {
        status = Number(headers[':status'] ?? 500)
        apnsId =
          typeof headers['apns-id'] === 'string' ? headers['apns-id'] : null
      })
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('error', reject)
      request.on('end', () => {
        clearTimeout(timer)
        session.close()
        const body = Buffer.concat(chunks).toString('utf8')
        let reason: string | null = null
        if (body) {
          try {
            const parsed = JSON.parse(body) as { reason?: unknown }
            reason = typeof parsed.reason === 'string' ? parsed.reason : body
          } catch {
            reason = body
          }
        }
        resolve({ status, apnsId, reason })
      })
      request.end(payload)
    }).finally(() => session.close())
  }

  private providerToken(
    app: ApnsAppConfig,
    environment: 'development' | 'production',
    key: ApnsKeyConfig,
  ) {
    const now = Math.floor(Date.now() / 1000)
    const cacheKey = `${app.id}:${environment}`
    const cached = this.tokenCache.get(cacheKey)
    if (cached && now - cached.issuedAtSeconds < 50 * 60) return cached.value

    const header = base64urlJSON({ alg: 'ES256', kid: key.keyId })
    const claims = base64urlJSON({ iss: app.teamId, iat: now })
    const signingInput = `${header}.${claims}`
    const signature = sign('sha256', Buffer.from(signingInput), {
      key: createPrivateKey(key.privateKey),
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url')
    const value = `${signingInput}.${signature}`
    this.tokenCache.set(cacheKey, { value, issuedAtSeconds: now })
    return value
  }
}

const customFields = (
  event: PushEvent,
  extras: Record<string, unknown> = {},
) => ({
  ...extras,
  schema_version: PUSH_PROTOCOL_VERSION,
  source_id: event.source.replace('urn:mx-core:instance:', ''),
  resource_type: event.data.resource_type,
  resource_id: event.data.resource_id,
})

const publishedCopy = {
  post: {
    subtitleLocKey: 'PUSH_CONTENT_POST_SUBTITLE',
    threadId: 'posts',
  },
  note: {
    subtitleLocKey: 'PUSH_CONTENT_NOTE_SUBTITLE',
    threadId: 'notes',
  },
  recently: {
    subtitleLocKey: 'PUSH_CONTENT_RECENTLY_SUBTITLE',
    threadId: 'recently',
  },
} as const

export const buildApnsPayload = (event: PushEvent) => {
  if (event.type === COMMENT_CREATED_EVENT) {
    return {
      aps: {
        alert: {
          title: 'New comment',
          body: 'A new comment is ready to review.',
        },
        sound: 'default',
        'thread-id': 'comments',
        category: 'SPACE_COMMENT',
      },
      ...customFields(event),
    }
  }

  if (event.type === CONTENT_PUBLISHED_EVENT) {
    const copy = publishedCopy[event.data.resource_type]
    return {
      aps: {
        alert: {
          'title-loc-key': 'PUSH_CONTENT_TITLE',
          'title-loc-args': [event.data.display_title],
          'subtitle-loc-key': copy.subtitleLocKey,
          'loc-key': 'PUSH_CONTENT_SUMMARY',
          'loc-args': [event.data.summary],
        },
        sound: 'default',
        'thread-id': copy.threadId,
        category: 'YOHAKU_CONTENT',
      },
      ...customFields(event, {
        event_type: event.type,
        target_path: event.data.target_path,
      }),
    }
  }

  if (event.type === COMMENT_REPLIED_EVENT) {
    return {
      aps: {
        alert: {
          'title-loc-key': 'PUSH_REPLY_TITLE',
          'title-loc-args': [event.data.sender_name],
          'loc-key': 'PUSH_REPLY_BODY',
          'loc-args': [event.data.target_title],
        },
        sound: 'default',
        'thread-id': 'comment-replies',
        category: 'YOHAKU_COMMENT_REPLIED',
        'mutable-content': 1,
      },
      ...customFields(event, {
        event_type: event.type,
        sender_id: event.data.sender_id,
        sender_name: event.data.sender_name,
        ...(event.data.sender_avatar_url
          ? { sender_avatar_url: event.data.sender_avatar_url }
          : {}),
        target_title: event.data.target_title,
        target_path: event.data.target_path,
      }),
    }
  }

  const exhaustive: never = event
  return exhaustive
}
