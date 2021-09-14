import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { getNestExecutionContextRequest } from '~/utils/nest.util'

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return getNestExecutionContextRequest(ctx).user
  },
)
