import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard as _AuthGuard } from '@nestjs/passport'
import { mockUser1 } from '~/mock/user.mock'
import { isTest } from '~/utils/index.util'
import { getNestExecutionContextRequest } from '~/utils/nest.util'

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
