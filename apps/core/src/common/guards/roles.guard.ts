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
    let hasAdminAccess = false
    try {
      await super.canActivate(context)
      hasAdminAccess = true
    } catch {}

    const session = await this.authService.getSessionUser(request.raw)
    const readerId = session?.user?.id || request.user?.id
    const authProvider = session?.provider
    const hasReaderIdentity = !!readerId

    if (readerId) {
      request.readerId = readerId
      Object.assign(request.raw, { readerId })
    }

    if (authProvider) {
      request.authProvider = authProvider
      Object.assign(request.raw, { authProvider })
    }

    request.hasAdminAccess = hasAdminAccess
    request.hasReaderIdentity = hasReaderIdentity
    request.isGuest = !hasReaderIdentity
    request.isAuthenticated = hasAdminAccess

    Object.assign(request.raw, {
      hasAdminAccess,
      hasReaderIdentity,
      isGuest: !hasReaderIdentity,
      isAuthenticated: hasAdminAccess,
    })

    return true
  }
}
