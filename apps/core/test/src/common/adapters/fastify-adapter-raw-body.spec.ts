import { describe, expect, it, vi } from 'vitest'

import {
  isMembershipWebhookRequest,
  membershipWebhookRawBodyPreParsingHook,
} from '~/common/adapters/fastify.adapter'

const createPayload = (chunks: Buffer[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) {
      yield chunk
    }
  },
})

const createReply = () => {
  const sent: { statusCode?: number; payload?: unknown } = {}
  return {
    code: vi.fn((statusCode: number) => {
      sent.statusCode = statusCode
      return {
        send: vi.fn((payload: unknown) => {
          sent.payload = payload
        }),
      }
    }),
    sent,
  }
}

describe('isMembershipWebhookRequest', () => {
  it('matches the membership webhook path prefix', () => {
    expect(isMembershipWebhookRequest('/membership/webhook/dodo')).toBe(true)
  })

  it('matches even when a query string is present', () => {
    expect(
      isMembershipWebhookRequest(
        '/membership/webhook/dodo?foo=/membership/webhook/',
      ),
    ).toBe(true)
  })

  it('does not match an unrelated path that merely contains the segment in its query string', () => {
    expect(
      isMembershipWebhookRequest('/other/route?next=/membership/webhook/dodo'),
    ).toBe(false)
  })

  it('does not match unrelated paths', () => {
    expect(isMembershipWebhookRequest('/posts/1')).toBe(false)
  })
})

describe('membershipWebhookRawBodyPreParsingHook', () => {
  it('buffers the full body and attaches it as request.rawBody', async () => {
    const request: any = {}
    const reply = createReply()
    const payload = createPayload([
      Buffer.from('{"eventId":'),
      Buffer.from('"evt_1"}'),
    ])

    const stream = await membershipWebhookRawBodyPreParsingHook(
      request,
      reply as any,
      payload as any,
    )

    const collected: Buffer[] = []
    for await (const chunk of stream) {
      collected.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    expect(Buffer.concat(collected).toString('utf8')).toBe(
      '{"eventId":"evt_1"}',
    )
    expect(request.rawBody.toString('utf8')).toBe('{"eventId":"evt_1"}')
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('aborts with 413 once the accumulated body exceeds 1 MiB', async () => {
    const request: any = {}
    const reply = createReply()
    const oneMib = 1024 * 1024
    const chunks = [Buffer.alloc(oneMib, 'a'), Buffer.alloc(16, 'b')]
    const payload = createPayload(chunks)

    const stream = await membershipWebhookRawBodyPreParsingHook(
      request,
      reply as any,
      payload as any,
    )

    expect(reply.code).toHaveBeenCalledWith(413)
    expect(reply.sent.payload).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    })
    expect(request.rawBody).toBeUndefined()

    const collected: Buffer[] = []
    for await (const chunk of stream) {
      collected.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    expect(Buffer.concat(collected).length).toBe(0)
  })
})
