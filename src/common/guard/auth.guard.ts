import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { isTest } from '~/global/env.global'
import { mockUser1 } from '~/mock/user.mock'
import { ConfigsService } from '~/modules/configs/configs.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

/**
 * JWT auth guard
 */

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    protected readonly jwtService: JWTService,
    protected readonly configs: ConfigsService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<any> {
    const request = this.getRequest(context)

    /// for e2e-test mock user
    if (isTest) {
      request.user = { ...mockUser1 }
      return true
    }
    const query = request.query as any
    const headers = request.headers
    const Authorization: string =
      headers.authorization || headers.Authorization || query.token

    if (!Authorization) {
      throw new UnauthorizedException('未登录')
    }
    const jwt = Authorization.replace(/[Bb]earer /, '')
    const ok = await this.jwtService.verify(jwt)
    if (!ok) {
      throw new UnauthorizedException('身份过期')
    }

    request.user = await this.configs.getMaster()
    request.token = jwt
    return true
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}
