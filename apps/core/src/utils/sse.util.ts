import type { FastifyReply, FastifyRequest } from 'fastify'

import { logger } from '~/global/consola.global'
import { isDev } from '~/global/env.global'

export function applyRawCorsHeaders(
  reply: FastifyReply,
  request?: FastifyRequest,
) {
  // Fastify CORS plugin sets headers on reply but we bypass via reply.raw,
  // so mirror the essentials manually for streaming endpoints.
  const origin = (request?.headers.origin as string | undefined) || ''
  if (origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin)
    reply.raw.setHeader('Vary', 'Origin')
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
  }
}

export function initSse(reply: FastifyReply, request?: FastifyRequest) {
  applyRawCorsHeaders(reply, request)
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
      logger.debug(`[sse] event=${event} no-data`)
    }
    reply.raw.write(`event: ${event}\n\n`)
    return
  }
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? null)
  if (isDev) {
    const size = typeof payload === 'string' ? payload.length : 0

    logger.debug(`[sse] event=${event} size=${size}`)
  }
  reply.raw.write(`event: ${event}\n`)
  reply.raw.write(`data: ${payload}\n\n`)
}

export function endSse(reply: FastifyReply) {
  reply.raw.end()
}
