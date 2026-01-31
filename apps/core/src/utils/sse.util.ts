import { isDev } from '~/global/env.global'
import type { FastifyReply } from 'fastify'

export function initSse(reply: FastifyReply) {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.setHeader('X-Accel-Buffering', 'no')
  reply.raw.flushHeaders()
}

export function sendSseEvent(
  reply: FastifyReply,
  event: string,
  data: unknown,
) {
  if (data === undefined) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(`[sse] event=${event} no-data`)
    }
    reply.raw.write(`event: ${event}\n\n`)
    return
  }
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? null)
  if (isDev) {
    const size = typeof payload === 'string' ? payload.length : 0
    // eslint-disable-next-line no-console
    console.debug(`[sse] event=${event} size=${size}`)
  }
  reply.raw.write(`event: ${event}\n`)
  reply.raw.write(`data: ${payload}\n\n`)
}

export function endSse(reply: FastifyReply) {
  reply.raw.end()
}
