import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard as _AuthGuard } from '@nestjs/passport'
import { isTest } from '~/global/env.global'
import { mockUser1 } from '~/mock/user.mock'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

/**
 * JWT auth guard
 */

@Injectable()
export class JWTAuthGuard extends _AuthGuard('jwt') implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = this.getRequest(context)

    if (typeof request.user !== 'undefined') {
      return true
    }

    /// for e2e-test mock user
    if (isTest) {
      request.user = { ...mockUser1 }
      return true
    }

    return super.canActivate(context)
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}
