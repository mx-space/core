import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { AuthGuard } from './auth.guard'

@Injectable()
export class RolesGuard extends AuthGuard implements CanActivate {
  constructor(
    protected readonly authService: AuthService,
    protected readonly configs: ConfigsService,
  ) {
    super(authService)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context)
    let isAuthenticated = false
    try {
      await super.canActivate(context)
      isAuthenticated = true
    } catch {}

    const session = await this.authService.getSessionUser(request.raw)
    const readerId = session?.user?.id || request.user?.id

    if (readerId) {
      request.readerId = readerId
      Object.assign(request.raw, { readerId })
    }

    request.isGuest = !isAuthenticated
    request.isAuthenticated = isAuthenticated

    Object.assign(request.raw, {
      isGuest: !isAuthenticated,
      isAuthenticated,
    })

    return true
  }
}
