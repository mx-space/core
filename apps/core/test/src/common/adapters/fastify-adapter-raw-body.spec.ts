import { describe, expect, it, vi } from 'vitest'

import {
  collectRawBodyPreParsingHook,
  isRawBodyRoute,
} from '~/common/adapters/fastify.adapter'
import { FASTIFY_ROUTE_OPTIONS_CONFIG } from '~/common/decorators/fastify-route-options.decorator'

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

describe('isRawBodyRoute', () => {
  it('matches a route whose config opts into rawBody', () => {
    const request: any = {
      routeOptions: {
        config: { [FASTIFY_ROUTE_OPTIONS_CONFIG]: { rawBody: true } },
      },
    }
    expect(isRawBodyRoute(request)).toBe(true)
  })

  it('does not match a route with options but no rawBody flag', () => {
    const request: any = {
      routeOptions: {
        config: { [FASTIFY_ROUTE_OPTIONS_CONFIG]: { bodyLimit: 1024 } },
      },
    }
    expect(isRawBodyRoute(request)).toBe(false)
  })

  it('does not match a route without route options config', () => {
    expect(isRawBodyRoute({ routeOptions: { config: {} } } as any)).toBe(false)
    expect(isRawBodyRoute({} as any)).toBe(false)
  })
})

describe('collectRawBodyPreParsingHook', () => {
  it('buffers the full body and attaches it as request.rawBody', async () => {
    const request: any = {}
    const reply = createReply()
    const payload = createPayload([
      Buffer.from('{"eventId":'),
      Buffer.from('"evt_1"}'),
    ])

    const stream = await collectRawBodyPreParsingHook(
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

  it('aborts with 413 once the accumulated body exceeds the limit', async () => {
    const request: any = {}
    const reply = createReply()
    const oneMib = 1024 * 1024
    const chunks = [Buffer.alloc(oneMib, 'a'), Buffer.alloc(16, 'b')]
    const payload = createPayload(chunks)

    const stream = await collectRawBodyPreParsingHook(
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

  it('respects a route-level limit override', async () => {
    const request: any = {}
    const reply = createReply()
    const payload = createPayload([Buffer.alloc(32, 'a')])

    await collectRawBodyPreParsingHook(
      request,
      reply as any,
      payload as any,
      16,
    )

    expect(reply.code).toHaveBeenCalledWith(413)
    expect(request.rawBody).toBeUndefined()
  })
})
