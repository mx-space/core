import { Body, Get, HttpCode, Patch, Post } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HttpCache } from '~/common/decorator/cache.decorator'
import {
  CurrentUser,
  CurrentUserToken,
} from '~/common/decorator/current-user.decorator'
import { BanInDemo } from '~/common/decorator/demo.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { getAvatar } from '~/utils'

import { AuthService } from '../auth/auth.service'
import { LoginDto, UserDto, UserPatchDto } from './user.dto'
import { UserDocument, UserModel } from './user.model'
import { UserService } from './user.service'

@ApiName
@ApiController(['master', 'user'])
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取主人信息' })
  async getMasterInfo(@IsMaster() isMaster: boolean) {
    return await this.userService.getMasterInfo(isMaster)
  }

  @Post('register')
  @ApiOperation({ summary: '注册' })
  async register(@Body() userDto: UserDto) {
    userDto.name = userDto.name ?? userDto.username
    return await this.userService.createMaster(userDto as UserModel)
  }

  @Post('login')
  @ApiOperation({ summary: '登录' })
  @HttpCache({ disable: true })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @IpLocation() ipLocation: IpRecord) {
    const user = await this.userService.login(dto.username, dto.password)
    const footstep = await this.userService.recordFootstep(ipLocation.ip)
    const { name, username, created, url, mail, id } = user
    const avatar = user.avatar ?? getAvatar(mail)

    return {
      token: this.authService.jwtServicePublic.sign(user._id),
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
  @ApiOperation({ summary: '判断当前 Token 是否有效 ' })
  @Auth()
  @HttpCache.disable
  checkLogged(@IsMaster() isMaster: boolean) {
    return { ok: +isMaster, isGuest: !isMaster }
  }

  @Patch()
  @ApiOperation({ summary: '修改主人的信息' })
  @Auth()
  @HttpCache.disable
  @BanInDemo
  async patchMasterData(
    @Body() body: UserPatchDto,
    @CurrentUser() user: UserDocument,
  ) {
    return await this.userService.patchUserData(user, body)
  }

  @Post('logout')
  @Auth()
  async singout(@CurrentUserToken() token: string) {
    return this.userService.signout(token)
  }
}
