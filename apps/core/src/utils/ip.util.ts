/**
 * @module utils/ip
 * @description IP utility functions
 */
import { URL } from 'url'
import type { FastifyRequest } from 'fastify'
import type { IncomingMessage } from 'http'

export const getIp = (request: FastifyRequest | IncomingMessage) => {
  const req = request as any

  const headers = request.headers

  let ip: string =
    headers['True-Client-IP'] ||
    headers['true-client-ip'] ||
    headers['CF-Connecting-IP'] ||
    headers['cf-connecting-ip'] ||
    headers['cf-connecting-ip-v6'] ||
    headers['CF-Connecting-IPv6'] ||
    headers['x-forwarded-for'] ||
    headers['X-Forwarded-For'] ||
    headers['X-Real-IP'] ||
    headers['x-real-ip'] ||
    req?.ip ||
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
