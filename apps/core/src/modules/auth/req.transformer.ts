import type { IncomingMessage } from 'node:http'

import { PayloadTooLargeException } from '@nestjs/common'

/**
 * @param {import('http').IncomingMessage} req
  
 */
function get_raw_body(req) {
  const h = req.headers

  if (!h['content-type']) {
    return null
  }

  const content_length = Number(h['content-length'])

  // check if no request body
  if (
    (req.httpVersionMajor === 1 &&
      Number.isNaN(content_length) &&
      h['transfer-encoding'] == null) ||
    content_length === 0
  ) {
    return null
  }

  if (req.destroyed) {
    const readable = new ReadableStream()
    readable.cancel()
    return readable
  }

  let size = 0
  let cancelled = false

  return new ReadableStream({
    start(controller) {
      req.on('error', (error) => {
        cancelled = true
        controller.error(error)
      })

      req.on('end', () => {
        if (cancelled) return
        controller.close()
      })

      req.on('data', (chunk) => {
        if (cancelled) return

        size += chunk.length
        if (size > content_length) {
          cancelled = true

          const constraint = content_length
            ? 'content-length'
            : 'BODY_SIZE_LIMIT'
          const message = `request body size exceeded ${constraint} of ${content_length}`

          const error = new PayloadTooLargeException(message)
          controller.error(error)

          return
        }

        controller.enqueue(chunk)

        if (controller.desiredSize === null || controller.desiredSize <= 0) {
          req.pause()
        }
      })
    },

    pull() {
      req.resume()
    },

    cancel(reason) {
      cancelled = true
      req.destroy(reason)
    },
  })
}

export async function getRequest(
  base: string,
  req: IncomingMessage,
): Promise<Request> {
  const headers = req.headers as Record<string, string>

  const request = new Request(base + req.originalUrl, {
    method: req.method,
    headers,
    body: get_raw_body(req),
    credentials: 'include',
    // @ts-expect-error
    duplex: 'half',
  })
  return request
}
