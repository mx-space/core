import { ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'

export function getNestExectionContextRequest(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<KV>()
  if (req) {
    return req
  }
  const ctx = GqlExecutionContext.create(context)
  return ctx.getContext().req
}
