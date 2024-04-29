import { isJWT } from 'class-validator'

import { Injectable, UnauthorizedException } from '@nestjs/common'

import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import type { UserModel } from '~/modules/user/user.model'
import type { CanActivate, ExecutionContext } from '@nestjs/common'

/**
 * JWT auth guard
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    protected readonly authService: AuthService,
    protected readonly configs: ConfigsService,

    protected readonly userService: UserService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<any> {
    const request = this.getRequest(context)

    const query = request.query as any
    const headers = request.headers
    const Authorization: string =
      headers.authorization || headers.Authorization || query.token

    if (!Authorization) {
      throw new UnauthorizedException('未登录')
    }

    if (this.authService.isCustomToken(Authorization)) {
      const [isValid, userModel] =
        await this.authService.verifyCustomToken(Authorization)
      if (!isValid) {
        throw new UnauthorizedException('令牌无效')
      }

      this.attachUserAndToken(request, userModel, Authorization)
      return true
    }

    const jwt = Authorization.replace(/[Bb]earer /, '')

    if (!isJWT(jwt)) {
      throw new UnauthorizedException('令牌无效')
    }
    const ownVerifyPass = await this.authService.jwtServicePublic.verify(jwt)

    if (!ownVerifyPass) {
      const cleckVerifyPass = await this.authService.verifyClerkJWT(jwt)
      if (!cleckVerifyPass) {
        throw new UnauthorizedException('身份过期')
      }
    }

    this.attachUserAndToken(
      request,
      await this.userService.getMaster(),
      Authorization,
    )
    return true
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }

  attachUserAndToken(
    request: FastifyBizRequest,
    user: UserModel,
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
