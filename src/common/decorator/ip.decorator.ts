/*
 * @Author: Innei
 * @Date: 2020-04-30 12:21:51
 * @LastEditTime: 2020-07-08 21:34:18
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/core/decorators/ip.decorator.ts
 * @Coding with Love
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { getIp } from '~/utils/ip'

export type IpRecord = {
  ip: string
  agent: string
}
export const IpLocation = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>()
    const ip = getIp(request)
    const agent = request.headers['user-agent']
    return {
      ip,
      agent,
    }
  },
)
