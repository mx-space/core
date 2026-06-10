/**
 * @module utils/ip
 * @description IP utility functions
 */
import type { IncomingMessage } from 'node:http'

import type { FastifyRequest } from 'fastify'

const headerValue = (v: unknown): string | undefined =>
  (Array.isArray(v) ? v[0] : v) as string | undefined

export const getIp = (request: FastifyRequest | IncomingMessage) => {
  const req = request as any

  const headers = request.headers

  // Trust model: Fastify is configured with `trustProxy` (see fastify.adapter),
  // so `request.ip` already resolves to the proxy-attested client IP by walking
  // only the trusted tail of `X-Forwarded-For`. Prefer it. We do NOT read the
  // leftmost XFF segment (the part fully under client control). Raw `True-Client-IP`
  // / `CF-Connecting-IP` are demoted below `request.ip` because they are only
  // trustworthy when the deployment actually sits behind Cloudflare — an
  // operator-specific assumption we don't bake in.
  const forwardedFor = headerValue(headers['x-forwarded-for'])

  const ip: string =
    req?.ip ||
    headerValue(headers['true-client-ip']) ||
    headerValue(headers['cf-connecting-ip']) ||
    headerValue(headers['cf-connecting-ipv6']) ||
    // When falling back to a raw XFF header (no framework-resolved ip), the
    // rightmost entry is the hop closest to our trusted proxy, hence the least
    // spoofable.
    forwardedFor?.split(',').at(-1)?.trim() ||
    headerValue(headers['x-real-ip']) ||
    req?.ips?.[0] ||
    req?.raw?.connection?.remoteAddress ||
    req?.raw?.socket?.remoteAddress ||
    ''

  return ip
}
