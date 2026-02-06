import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { BizException } from '../exceptions/biz.exception'

/**
 * Better Auth (cookie + API key) guard
 */

@Injectable()
export class AuthGuard implements CanActivate {
  protected readonly logger = new Logger(AuthGuard.name)
  constructor(protected readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<any> {
    const request = this.getRequest(context)

    const session = await this.authService.getSessionUser(request.raw)

    if (session) {
      const isOwner = session.user?.role === 'owner'

      if (isOwner) {
        this.attachUserAndToken(
          request,
          session.user as SessionUser,
          session.session?.token || '',
        )
        return true
      }
    }

    const apiKey = this.authService.getApiKeyFromRequest({
      headers: request.headers,
      query: request.query as any,
    })

    if (!apiKey) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    if (apiKey.deprecated) {
      // this.logger.warn(
      //   '[Auth] Authorization bearer token is deprecated. Use x-api-key instead.',
      // )
    }

    if (!this.authService.isCustomToken(apiKey.key)) {
      throw new BizException(ErrorCodeEnum.AuthTokenInvalid)
    }

    const result = await this.authService.verifyApiKey(apiKey.key)
    if (!result?.userId) {
      throw new BizException(ErrorCodeEnum.AuthTokenInvalid)
    }

    const isOwner = await this.authService.isOwnerReaderId(result.userId)
    if (!isOwner) {
      throw new BizException(ErrorCodeEnum.AuthTokenInvalid)
    }

    const readerUser = await this.authService.getReaderById(result.userId)
    if (!readerUser) {
      throw new BizException(ErrorCodeEnum.AuthTokenInvalid)
    }
    this.attachUserAndToken(request, readerUser, apiKey.key)
    return true
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }

  attachUserAndToken(
    request: FastifyBizRequest,
    user: SessionUser,
    token: string,
  ) {
    request.user = user
    request.token = token

    Object.assign(request.raw, {
      user,
      token,
    })
  }
}
