import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { getNestExectionContextRequest } from '~/utils/nest.util'

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return getNestExectionContextRequest(ctx).user
  },
)
