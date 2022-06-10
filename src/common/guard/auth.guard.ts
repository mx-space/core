import jwtoken from 'jsonwebtoken'

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { __secret, isTest } from '~/global/env.global'
import { mockUser1 } from '~/mock/user.mock'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

/**
 * JWT auth guard
 */

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<any> {
    const request = this.getRequest(context)

    if (typeof request.user !== 'undefined') {
      return true
    }

    /// for e2e-test mock user
    if (isTest) {
      request.user = { ...mockUser1 }
      return true
    }
    const query = request.query as any
    const headers = request.headers
    const Authorization =
      headers.authorization || headers.Authorization || query.token

    if (!Authorization) {
      throw new UnauthorizedException()
    }
    const jwt = Authorization.replace('Bearer ', '')
    try {
      const payload = jwtoken.verify(jwt, __secret)
    } catch {
      throw new UnauthorizedException()
    }
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}
