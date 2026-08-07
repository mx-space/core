import { describe, expect, it } from 'vitest'

import {
  COMMENT_CREATED_EVENT,
  PushEventSchema,
  isPushTimestampFresh,
  signPushRequest,
  verifyPushRequestSignature,
} from '../src/index.js'

const event = {
  specversion: '1.0',
  id: 'comment.created:123',
  source: 'urn:mx-core:instance:src_example',
  type: COMMENT_CREATED_EVENT,
  subject: 'comment/123',
  time: '2026-08-07T12:00:00.000Z',
  datacontenttype: 'application/json',
  data: { resource_id: '123', resource_type: 'comment' },
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
})
