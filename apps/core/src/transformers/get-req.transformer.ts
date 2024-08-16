import type { ExecutionContext } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { FastifyRequest } from 'fastify'

export type FastifyBizRequest = FastifyRequest & {
  user?: UserModel
  isGuest: boolean

  isAuthenticated: boolean
  token?: string
}
export function getNestExecutionContextRequest(
  context: ExecutionContext,
): FastifyBizRequest {
  return context.switchToHttp().getRequest<FastifyRequest>() as any
}
