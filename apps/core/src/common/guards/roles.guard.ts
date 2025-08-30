import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { AuthGuard } from './auth.guard'

/**
 * 区分游客和主人的守卫
 */

@Injectable()
export class RolesGuard extends AuthGuard implements CanActivate {
  constructor(
    protected readonly authService: AuthService,
    protected readonly configs: ConfigsService,

    protected readonly userService: UserService,
  ) {
    super(authService, configs, userService)
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context)
    let isAuthenticated = false
    try {
      await super.canActivate(context)
      isAuthenticated = true
    } catch {}

    const session = await this.authService.getSessionUser(request.raw)

    if (session) {
      const readerId = session.user?.id

      request.readerId = readerId

      Object.assign(request.raw, {
        readerId,
      })
    }

    request.isGuest = !isAuthenticated
    request.isAuthenticated = isAuthenticated

    Object.assign(request.raw, {
      isGuest: !isAuthenticated,

      isAuthenticated,
    })

    return true
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}
