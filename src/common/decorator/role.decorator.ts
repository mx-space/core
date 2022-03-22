import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

export const IsGuest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    return request.isGuest
  },
)

export const IsMaster = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = getNestExecutionContextRequest(ctx)
    return request.isMaster
  },
)
