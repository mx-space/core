/**
 * @module utils/ip
 * @description IP utility functions
 */
import { IncomingMessage } from 'http'
import { URL } from 'url'
import { FastifyRequest } from 'fastify'

export const getIp = (request: FastifyRequest | IncomingMessage) => {
  const req = request as any

  let ip: string =
    request.headers['x-forwarded-for'] ||
    request.headers['X-Forwarded-For'] ||
    request.headers['X-Real-IP'] ||
    request.headers['x-real-ip'] ||
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
