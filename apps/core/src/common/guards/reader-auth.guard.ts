import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class ReaderAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getNestExecutionContextRequest(context)

    const session = await this.authService.getSessionUser(request.raw)
    const user = session?.user as SessionUser | undefined

    if (!user?.id) {
      throw createAppException(AppErrorCode.AUTH_NOT_LOGGED_IN)
    }

    if (user.role !== 'reader' && user.role !== 'owner') {
      throw createAppException(AppErrorCode.AUTH_NOT_LOGGED_IN)
    }

    request.user = user
    request.readerId = user.id
    request.isAuthenticated = true
    request.hasReaderIdentity = true
    request.hasAdminAccess = user.role === 'owner'
    request.isGuest = false

    Object.assign(request.raw, {
      user,
      readerId: user.id,
      isAuthenticated: true,
      hasReaderIdentity: true,
      hasAdminAccess: user.role === 'owner',
      isGuest: false,
    })

    return true
  }
}
