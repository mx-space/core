import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { getNestExectionContextRequest } from '~/utils/nest.util'

export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExectionContextRequest(ctx)
    return request.isGuest
  },
)

export const IsMaster = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExectionContextRequest(ctx)
    return request.isMaster
  },
)
