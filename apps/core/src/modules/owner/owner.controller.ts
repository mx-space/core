import { Body, Get, Patch } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
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
  async getOwnerInfo(@IsAuthenticated() isAuthenticated: boolean) {
    return await this.ownerService.getOwnerInfo(isAuthenticated)
  }

  @Patch()
  @Auth()
  async patchOwner(@Body() body: OwnerPatchDto) {
    return this.ownerService.patchOwnerData(body)
  }

  @Get('/allow-login')
  @HttpCache({ disable: true })
  @HTTPDecorators.Bypass
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
      ...oauthProviders.reduce(
        (acc, cur) => {
          acc[cur.toLowerCase()] = true
          return acc
        },
        {} as Record<string, boolean>,
      ),
    }
  }

  @Get('check_logged')
  @HttpCache.disable
  checkLogged(@IsAuthenticated() isAuthenticated: boolean) {
    return { ok: +isAuthenticated, isGuest: !isAuthenticated }
  }
}
