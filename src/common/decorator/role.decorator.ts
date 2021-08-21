import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.isGuest
  },
)

export const IsMaster = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.isMaster
  },
)
