import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import { getIp } from '~/utils/ip.util'
import type { FastifyRequest } from 'fastify'

export type IpRecord = {
  ip: string
  agent: string
}
export const IpLocation = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>()
    const ip = getIp(request)
    const agent = request.headers['user-agent']
    return {
      ip,
      agent,
    }
  },
)
