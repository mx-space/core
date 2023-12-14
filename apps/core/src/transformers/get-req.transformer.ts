import type { ExecutionContext } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { FastifyRequest } from 'fastify'

export type FastifyBizRequest = FastifyRequest & { user?: UserModel } & Record<
    string,
    any
  >
export function getNestExecutionContextRequest(
  context: ExecutionContext,
): FastifyBizRequest {
  return context.switchToHttp().getRequest<FastifyRequest>()
}
