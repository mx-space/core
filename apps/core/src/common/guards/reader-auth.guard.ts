import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

import { BizException } from '../exceptions/biz.exception'

@Injectable()
export class ReaderAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getNestExecutionContextRequest(context)

    const session = await this.authService.getSessionUser(request.raw)
    const user = session?.user as SessionUser | undefined

    if (!user?.id) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    if (user.role !== 'reader' && user.role !== 'owner') {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
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
