import { ExecutionContext, createParamDecorator } from '@nestjs/common'

import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return getNestExecutionContextRequest(ctx).user
  },
)
