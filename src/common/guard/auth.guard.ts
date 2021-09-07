import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard as _AuthGuard } from '@nestjs/passport'

/**
 * JWT auth guard
 */

@Injectable()
export class JWTAuthGuard extends _AuthGuard('jwt') implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<any>()
    if (typeof request.user !== 'undefined') {
      return true
    }

    return super.canActivate(context)
  }
}
