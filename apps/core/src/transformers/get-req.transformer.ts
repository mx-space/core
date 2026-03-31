import type { IncomingMessage } from 'node:http'

import type { ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import type { SessionUser } from '~/modules/auth/auth.types'

type BizRequest = {
  user?: SessionUser
  isGuest: boolean

  authProvider?: string
  hasAdminAccess?: boolean
  hasReaderIdentity?: boolean
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
