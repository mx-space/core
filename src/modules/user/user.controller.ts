import { Body, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common'
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
    await this.authService.jwtServicePublic.revokeToken(token)
    await this.userService.recordFootstep(ipLocation.ip)
    return {
      token: this.authService.jwtServicePublic.sign(user._id, {
        ip: ipLocation.ip,
        ua: ipLocation.agent,
      }),
    }
  }

  @Post('/login')
  @HttpCache({ disable: true })
  async login(@Body() dto: LoginDto, @IpLocation() ipLocation: IpRecord) {
    const user = await this.userService.login(dto.username, dto.password)
    const footstep = await this.userService.recordFootstep(ipLocation.ip)
    const { name, username, created, url, mail, id } = user
    const avatar = user.avatar ?? getAvatar(mail)

    return {
      token: this.authService.jwtServicePublic.sign(user._id, {
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
  @ApiOperation({ summary: '判断当前 Token 是否有效 ' })
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
