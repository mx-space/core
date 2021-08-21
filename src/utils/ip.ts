/*
 * @Author: Innei
 * @Date: 2020-05-10 15:31:44
 * @LastEditTime: 2020-07-08 21:42:06
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/utils/ip.ts
 * @Coding with Love
 */

import { FastifyRequest } from 'fastify'
import { IncomingMessage } from 'http'

export const getIp = (request: FastifyRequest | IncomingMessage) => {
  const _ = request as any

  let ip: string =
    _.headers['x-forwarded-for'] ||
    _.ip ||
    _.raw.connection.remoteAddress ||
    _.raw.socket.remoteAddress ||
    undefined
  if (ip && ip.split(',').length > 0) {
    ip = ip.split(',')[0]
  }
  return ip
}
