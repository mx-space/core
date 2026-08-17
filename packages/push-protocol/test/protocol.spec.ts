import { describe, expect, it } from 'vitest'

import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  ClaimSourceActivationSchema,
  DEFAULT_PUSH_PREFERENCES,
  PushEventSchema,
  PushPreferencesSchema,
  isPushTimestampFresh,
  signPushRequest,
  verifyPushRequestSignature,
} from '../src/index.js'

const cloudEventBase = {
  specversion: '1.0',
  source: 'urn:mx-core:instance:src_example',
  time: '2026-08-07T12:00:00.000Z',
  datacontenttype: 'application/json',
} as const

const event = {
  ...cloudEventBase,
  id: 'comment.created:123',
  type: COMMENT_CREATED_EVENT,
  subject: 'comment/123',
  data: { resource_id: '123', resource_type: 'comment' },
} as const

const spaceClaimBody = {
  ticket: 'a'.repeat(32),
  source_origin: 'https://core.example.com',
} as const

describe('push protocol', () => {
  it('accepts the private comment projection and rejects added visitor data', () => {
    expect(PushEventSchema.parse(event)).toEqual(event)
    expect(() =>
      PushEventSchema.parse({
        ...event,
        data: { ...event.data, author: 'Visitor', text: 'Private text' },
      }),
    ).toThrow()
  })

  it('signs the raw body with timestamp and delivery identity', () => {
    const input = {
      secret: 'source-secret',
      timestamp: '1786104000000',
      deliveryId: 'delivery-1',
      rawBody: JSON.stringify(event),
    }
    const signature = signPushRequest(input)

    expect(signature).toMatch(/^v1=[\da-f]{64}$/)
    expect(verifyPushRequestSignature({ ...input, signature })).toBe(true)
    expect(
      verifyPushRequestSignature({ ...input, rawBody: '{}', signature }),
    ).toBe(false)
  })

  it('enforces the five-minute replay window', () => {
    expect(isPushTimestampFresh('1786104000000', 1786104299999)).toBe(true)
    expect(isPushTimestampFresh('1786104000000', 1786104300001)).toBe(false)
    expect(isPushTimestampFresh('not-a-timestamp', 1786104000000)).toBe(false)
  })

  it.each(['post', 'note', 'recently'] as const)(
    'accepts content.published.v1 for resource_type %s',
    (resourceType) => {
      const published = {
        ...cloudEventBase,
        id: `content.published:${resourceType}-1`,
        type: CONTENT_PUBLISHED_EVENT,
        subject: `${resourceType}/abc`,
        data: { resource_id: 'abc', resource_type: resourceType },
      }

      expect(CONTENT_PUBLISHED_EVENT).toBe(
        'dev.mx-space.content.published.v1',
      )
      expect(PushEventSchema.parse(published)).toEqual(published)
    },
  )

  it('rejects extra visitor data on content.published.v1', () => {
    const result = PushEventSchema.safeParse({
      ...cloudEventBase,
      id: 'content.published:post-1',
      type: CONTENT_PUBLISHED_EVENT,
      subject: 'post/abc',
      data: {
        resource_id: 'abc',
        resource_type: 'post',
        title: 'Private title',
        text: 'Private body',
      },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(
      true,
    )
  })

  it('accepts comment.replied.v1 with recipient_reader_id for signed routing', () => {
    const replied = {
      ...cloudEventBase,
      id: 'comment.replied:456',
      type: COMMENT_REPLIED_EVENT,
      subject: 'comment/456',
      data: {
        resource_id: '456',
        resource_type: 'comment',
        recipient_reader_id: 'reader_1',
      },
    }

    expect(COMMENT_REPLIED_EVENT).toBe('dev.mx-space.comment.replied.v1')
    expect(PushEventSchema.parse(replied)).toEqual(replied)
  })

  it('rejects extra visitor data on comment.replied.v1', () => {
    const result = PushEventSchema.safeParse({
      ...cloudEventBase,
      id: 'comment.replied:456',
      type: COMMENT_REPLIED_EVENT,
      subject: 'comment/456',
      data: {
        resource_id: '456',
        resource_type: 'comment',
        recipient_reader_id: 'reader_1',
        author: 'Visitor',
        text: 'Private reply',
      },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(
      true,
    )
  })

  it('rejects comment.replied.v1 without recipient_reader_id', () => {
    const result = PushEventSchema.safeParse({
      ...cloudEventBase,
      id: 'comment.replied:456',
      type: COMMENT_REPLIED_EVENT,
      subject: 'comment/456',
      data: { resource_id: '456', resource_type: 'comment' },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(
      result.error.issues.some((issue) =>
        issue.path.includes('recipient_reader_id'),
      ),
    ).toBe(true)
  })

  it('parses a complete strict preferences object and exports all-true defaults', () => {
    expect(DEFAULT_PUSH_PREFERENCES).toEqual({
      content_post: true,
      content_note: true,
      content_recently: true,
      comment_replied: true,
    })
    expect(PushPreferencesSchema.parse(DEFAULT_PUSH_PREFERENCES)).toEqual(
      DEFAULT_PUSH_PREFERENCES,
    )
  })

  it('freezes default push preferences so mutation cannot alter them', () => {
    expect(Object.isFrozen(DEFAULT_PUSH_PREFERENCES)).toBe(true)
    if (!Object.isFrozen(DEFAULT_PUSH_PREFERENCES)) return

    expect(
      Reflect.set(DEFAULT_PUSH_PREFERENCES as object, 'content_post', false),
    ).toBe(false)
    expect(DEFAULT_PUSH_PREFERENCES.content_post).toBe(true)
  })

  it('rejects extra keys and incomplete preference objects', () => {
    const extra = PushPreferencesSchema.safeParse({
      ...DEFAULT_PUSH_PREFERENCES,
      extra_channel: true,
    })
    const incomplete = PushPreferencesSchema.safeParse({ content_post: true })

    expect(extra.success).toBe(false)
    expect(incomplete.success).toBe(false)
    if (!extra.success) {
      expect(extra.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(
        true,
      )
    }
  })

  it('accepts the existing Space claim body without reader_id or preferences', () => {
    const parsed = ClaimSourceActivationSchema.parse(spaceClaimBody)
    expect(parsed).toEqual(spaceClaimBody)
    expect(parsed).not.toHaveProperty('reader_id')
    expect(parsed).not.toHaveProperty('preferences')
  })

  it('accepts optional reader_id and preferences on claim without injecting defaults', () => {
    const claimed = {
      ...spaceClaimBody,
      source_label: 'core.example.com',
      reader_id: 'reader_1',
      preferences: {
        content_post: false,
        content_note: true,
        content_recently: true,
        comment_replied: false,
      },
    }

    expect(ClaimSourceActivationSchema.parse(claimed)).toEqual(claimed)
  })

  it.each([
    {
      name: 'content.published type mismatch',
      event: {
        ...cloudEventBase,
        id: 'content.published:post-1',
        type: CONTENT_PUBLISHED_EVENT,
        subject: 'note/abc',
        data: { resource_id: 'abc', resource_type: 'post' as const },
      },
    },
    {
      name: 'content.published id mismatch',
      event: {
        ...cloudEventBase,
        id: 'content.published:post-1',
        type: CONTENT_PUBLISHED_EVENT,
        subject: 'post/other',
        data: { resource_id: 'abc', resource_type: 'post' as const },
      },
    },
    {
      name: 'comment.replied id mismatch',
      event: {
        ...cloudEventBase,
        id: 'comment.replied:456',
        type: COMMENT_REPLIED_EVENT,
        subject: 'comment/other',
        data: {
          resource_id: '456',
          resource_type: 'comment' as const,
          recipient_reader_id: 'reader_1',
        },
      },
    },
  ])('rejects $name when subject is not resource_type/resource_id', ({ event }) => {
    const result = PushEventSchema.safeParse(event)
    expect(result.success).toBe(false)
  })

  it('keeps comment.created.v1 valid when subject does not match resource_id', () => {
    const mismatched = {
      ...event,
      subject: 'comment/other',
      data: { resource_id: '123', resource_type: 'comment' as const },
    }
    expect(PushEventSchema.parse(mismatched)).toEqual(mismatched)
  })
})
