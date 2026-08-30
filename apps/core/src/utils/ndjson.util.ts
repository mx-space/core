import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'

import { applyRawCorsHeaders } from './sse.util'

export function applyNdjsonHeaders(
  reply: FastifyReply,
  request?: FastifyRequest,
) {
  applyRawCorsHeaders(reply, request)
  reply.raw.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
  reply.raw.setHeader('X-Accel-Buffering', 'no')
  reply.raw.flushHeaders()
}

export function writeNdjsonLine(reply: FastifyReply, line: unknown) {
  reply.raw.write(`${JSON.stringify(line)}\n`)
}

export function subscribeNdjson(
  reply: FastifyReply,
  stream$: Observable<unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const subscription = stream$.subscribe({
      next: (line) => writeNdjsonLine(reply, line),
      error: (error) => {
        if (!reply.raw.writableEnded) reply.raw.end()
        reject(error)
      },
      complete: () => {
        if (!reply.raw.writableEnded) reply.raw.end()
        resolve()
      },
    })
    reply.raw.once('close', () => {
      subscription.unsubscribe()
      if (!reply.raw.writableEnded) reply.raw.end()
      resolve()
    })
  })
}
