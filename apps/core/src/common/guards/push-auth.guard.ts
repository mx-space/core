import type { ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import type { SessionUser } from '~/modules/auth/auth.types'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'

import { AuthGuard } from './auth.guard'

const isPushSessionUser = (
  user: SessionUser | undefined,
): user is SessionUser =>
  user != null &&
  Boolean(user.id) &&
  (user.role === 'reader' || user.role === 'owner')

@Injectable()
export class PushAuthGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context)
    const session = await this.authService.getSessionUser(request.raw)
    const user = session?.user as SessionUser | undefined

    if (isPushSessionUser(user)) {
      this.attachPushPrincipal(request, user, session?.session?.token || '')
      return true
    }

    await this.activateOwnerApiKey(request)
    if (!request.user) return false
    this.attachPushPrincipal(request, request.user, request.token || '')
    return true
  }

  private attachPushPrincipal(
    request: FastifyBizRequest,
    user: SessionUser,
    token: string,
  ) {
    this.attachUserAndToken(request, user, token)
    request.readerId = user.id
    request.isAuthenticated = true
    request.hasReaderIdentity = true
    request.hasAdminAccess = user.role === 'owner'
    request.isGuest = false
    Object.assign(request.raw, {
      readerId: user.id,
      isAuthenticated: true,
      hasReaderIdentity: true,
      hasAdminAccess: user.role === 'owner',
      isGuest: false,
    })
  }
}
