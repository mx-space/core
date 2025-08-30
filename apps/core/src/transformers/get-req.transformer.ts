import type { IncomingMessage } from 'node:http'
import type { ExecutionContext } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { FastifyRequest } from 'fastify'

type BizRequest = {
  user?: UserModel
  isGuest: boolean

  isAuthenticated: boolean
  token?: string
  readerId?: string
}

export type FastifyBizRequest = FastifyRequest & BizRequest

export type BizIncomingMessage = IncomingMessage & BizRequest
export function getNestExecutionContextRequest(
  context: ExecutionContext,
): FastifyBizRequest {
  return context.switchToHttp().getRequest<FastifyRequest>() as any
}
