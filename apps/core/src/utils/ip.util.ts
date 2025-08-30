/**
 * @module utils/ip
 * @description IP utility functions
 */
import type { IncomingMessage } from 'node:http'
import { URL } from 'node:url'
import type { FastifyRequest } from 'fastify'

export const getIp = (request: FastifyRequest | IncomingMessage) => {
  const req = request as any

  const headers = request.headers

  let ip: string =
    headers['True-Client-IP'] ||
    headers['true-client-ip'] ||
    headers['CF-Connecting-IP'] ||
    headers['cf-connecting-ip'] ||
    headers['cf-connecting-ipv6'] ||
    headers['CF-Connecting-IPv6'] ||
    headers['x-forwarded-for'] ||
    headers['X-Forwarded-For'] ||
    headers['X-Real-IP'] ||
    headers['x-real-ip'] ||
    req?.ip ||
    req?.ips?.[0] ||
    req?.raw?.connection?.remoteAddress ||
    req?.raw?.socket?.remoteAddress ||
    undefined
  if (ip && ip.split(',').length > 0) {
    ip = ip.split(',')[0]
  }
  return ip
}

export const parseRelativeUrl = (path: string) => {
  if (!path || !path.startsWith('/')) {
    return new URL('http://a.com')
  }
  return new URL(`http://a.com${path}`)
}
