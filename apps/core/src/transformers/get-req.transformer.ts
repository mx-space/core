import type { ExecutionContext } from '@nestjs/common'
import type { UserModel } from '~/modules/user/user.model'
import type { FastifyRequest } from 'fastify'

export function getNestExecutionContextRequest(
  context: ExecutionContext,
): FastifyRequest & { user?: UserModel } & Record<string, any> {
  return context.switchToHttp().getRequest<FastifyRequest>()
}
