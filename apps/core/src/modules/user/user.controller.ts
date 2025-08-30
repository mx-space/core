import {
  BadRequestException,
  Body,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import {
  CurrentUser,
  CurrentUserToken,
} from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { getAvatar } from '~/utils/tool.util'
import { AuthService } from '../auth/auth.service'
import { AuthnService } from '../authn/authn.service'
import { ConfigsService } from '../configs/configs.service'
import { LoginDto, UserDto, UserPatchDto } from './user.dto'
import type { UserModel } from './user.model'
import { UserDocument } from './user.model'
import { UserService } from './user.service'

@ApiController(['master', 'user'])
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly configService: ConfigsService,

    @Inject(forwardRef(() => AuthnService))
    private readonly authnService: AuthnService,
  ) {}

  @Get()
  async getMasterInfo(@IsAuthenticated() isAuthenticated: boolean) {
    return await this.userService.getMasterInfo(isAuthenticated)
  }

  @Post('/register')
  async register(@Body() userDto: UserDto) {
    userDto.name = userDto.name ?? userDto.username
    return await this.userService.createMaster(userDto as UserModel)
  }

  @Put('/login')
  @Auth()
  async loginWithToken(
    @IpLocation() ipLocation: IpRecord,
    @CurrentUser() user: UserDocument,
    @CurrentUserToken() token: string,
  ) {
    await this.userService.recordFootstep(ipLocation.ip)
    const singedToken = await this.authService.jwtServicePublic.sign(user.id, {
      ip: ipLocation.ip,
      ua: ipLocation.agent,
    })

    this.authService.jwtServicePublic.revokeToken(token, 6000)
    return {
      token: singedToken,
    }
  }

  @Get('/allow-login')
  @HttpCache({ disable: true })
  @HTTPDecorators.Bypass
  async allowLogin() {
    const [allowPasswordLogin, canAuthByPasskey, oauthProviders] =
      await Promise.all([
        this.configService
          .get('authSecurity')
          .then((config) => config.disablePasswordLogin === false),
        this.authnService.hasAuthnItem(),
        this.authService.getOauthProviders(),
      ])

    return {
      password: isDev ? true : allowPasswordLogin,
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

  @Post('/login')
  @HttpCache({ disable: true })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @IpLocation() ipLocation: IpRecord) {
    const allowPasswordLogin =
      (await this.configService.get('authSecurity')).disablePasswordLogin ===
      false

    if (!allowPasswordLogin && !isDev)
      throw new BadRequestException('密码登录已禁用')

    const user = await this.userService.login(dto.username, dto.password)
    const footstep = await this.userService.recordFootstep(ipLocation.ip)
    const { name, username, created, url, mail, id } = user
    const avatar = user.avatar ?? getAvatar(mail)

    return {
      token: await this.authService.jwtServicePublic.sign(user.id, {
        ip: ipLocation.ip,
        ua: ipLocation.agent,
      }),
      ...footstep,
      name,
      username,
      created,
      url,
      mail,
      avatar,
      id,
    }
  }

  @Get('check_logged')
  @HttpCache.disable
  checkLogged(@IsAuthenticated() isAuthenticated: boolean) {
    return { ok: +isAuthenticated, isGuest: !isAuthenticated }
  }

  @Patch()
  @Auth()
  @HttpCache.disable
  async patchMasterData(
    @Body() body: UserPatchDto,
    @CurrentUser() user: UserDocument,
  ) {
    return await this.userService.patchUserData(user, body)
  }

  @Post('/logout')
  @Auth()
  singout(@CurrentUserToken() token: string) {
    return this.userService.signout(token)
  }

  @Get('/session')
  @Auth()
  getAllSession(@CurrentUserToken() token: string) {
    return this.authService.jwtServicePublic.getAllSignSession(token)
  }

  @Delete('/session/:tokenId')
  @Auth()
  deleteSession(@Param('tokenId') tokenId: string) {
    return this.authService.jwtServicePublic.revokeToken(tokenId)
  }

  @Delete('/session/all')
  @Auth()
  deleteAllSession(@CurrentUserToken() currentToken: string) {
    return this.authService.jwtServicePublic.revokeAll([currentToken])
  }
}
