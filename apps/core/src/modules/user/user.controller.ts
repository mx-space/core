import type { UserModel } from './user.model'

import {
  BadRequestException,
  Body,
  Delete,
  Get,
  HttpCode,
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
import { BanInDemo } from '~/common/decorators/demo.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { IsMaster } from '~/common/decorators/role.decorator'
import { getAvatar } from '~/utils'

import { AuthService } from '../auth/auth.service'
import { ConfigsService } from '../configs/configs.service'
import { LoginDto, UserDto, UserPatchDto } from './user.dto'
import { UserDocument } from './user.model'
import { UserService } from './user.service'

@ApiController(['master', 'user'])
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly configService: ConfigsService,
  ) {}

  @Get()
  async getMasterInfo(@IsMaster() isMaster: boolean) {
    return await this.userService.getMasterInfo(isMaster)
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
  async allowLogin() {
    const allowPasswordLogin =
      (await this.configService.get('authSecurity')).disablePasswordLogin ===
      false

    return {
      password: allowPasswordLogin,

      // TODO
      passkey: true,
    }
  }

  @Post('/login')
  @HttpCache({ disable: true })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @IpLocation() ipLocation: IpRecord) {
    const allowPasswordLogin =
      (await this.configService.get('authSecurity')).disablePasswordLogin ===
      false

    if (!allowPasswordLogin) throw new BadRequestException('密码登录已禁用')

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
  checkLogged(@IsMaster() isMaster: boolean) {
    return { ok: +isMaster, isGuest: !isMaster }
  }

  @Patch()
  @Auth()
  @HttpCache.disable
  @BanInDemo
  async patchMasterData(
    @Body() body: UserPatchDto,
    @CurrentUser() user: UserDocument,
  ) {
    return await this.userService.patchUserData(user, body)
  }

  @Post('/logout')
  @Auth()
  async singout(@CurrentUserToken() token: string) {
    return this.userService.signout(token)
  }

  @Get('/session')
  @Auth()
  async getAllSession(@CurrentUserToken() token: string) {
    return this.authService.jwtServicePublic.getAllSignSession(token)
  }

  @Delete('/session/:tokenId')
  @Auth()
  async deleteSession(@Param('tokenId') tokenId: string) {
    return this.authService.jwtServicePublic.revokeToken(tokenId)
  }

  @Delete('/session/all')
  @Auth()
  async deleteAllSession() {
    return this.authService.jwtServicePublic.revokeAll()
  }
}
