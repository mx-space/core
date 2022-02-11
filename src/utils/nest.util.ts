import { ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
export function getNestExecutionContextRequest(
  context: ExecutionContext,
): FastifyRequest & KV {
  return context.switchToHttp().getRequest<FastifyRequest>()
  // if (req) {
  //   return req
  // }
  // const ctx = GqlExecutionContext.create(context)
  // return ctx.getContext().req
}
