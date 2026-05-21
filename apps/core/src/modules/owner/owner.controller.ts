import { Body, Get, Patch } from '@nestjs/common'

import { RequestContext } from '~/common/contexts/request.context'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'

import { AuthService } from '../auth/auth.service'
import { ConfigsService } from '../configs/configs.service'
import { OwnerPatchDto } from './owner.schema'
import { OwnerService } from './owner.service'

@ApiController(['owner', 'user'])
export class OwnerController {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly authService: AuthService,
    private readonly configsService: ConfigsService,
  ) {}

  @Get()
  async getOwnerInfo() {
    return await this.ownerService.getOwnerInfo(RequestContext.hasAdminAccess())
  }

  @Patch()
  @Auth()
  async patchOwner(@Body() body: OwnerPatchDto) {
    return this.ownerService.patchOwnerData(body)
  }

  @Get('/allow-login')
  @HttpCache({ disable: true })
  async allowLogin() {
    const { disablePasswordLogin } =
      await this.configsService.get('authSecurity')
    const [canAuthByPasskey, oauthProviders, hasCredentialAccount] =
      await Promise.all([
        this.authService.hasPasskey(),
        this.authService.getOauthProviders(),
        this.authService.hasCredentialAccount(),
      ])

    return {
      password: hasCredentialAccount && !disablePasswordLogin,
      passkey: canAuthByPasskey,
      ...Object.fromEntries(
        oauthProviders.map((provider) => [provider.toLowerCase(), true]),
      ),
    }
  }

  @Get('check_logged')
  @HttpCache.disable
  checkLogged() {
    const hasAdminAccess = RequestContext.hasAdminAccess()
    return { ok: +hasAdminAccess, isGuest: !hasAdminAccess }
  }
}
