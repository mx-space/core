import { Body, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { AuthService } from '../auth/auth.service'
import { UserDocument } from '../user/user.model'
import { UserService } from '../user/user.service'
import { AuthnService } from './authn.service'

@ApiController('/passkey')
export class AuthnController {
  constructor(
    private readonly authnService: AuthnService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('/register')
  @HTTPDecorators.Bypass
  @Auth()
  async newAuthn(@CurrentUser() user: UserDocument) {
    const r = await this.authnService.generateRegistrationOptions(user)
    return r.registrationOptions
  }

  @Post('/register/verify')
  @HTTPDecorators.Bypass
  @Auth()
  async responseAuthn(@CurrentUser() user: UserDocument, @Body() body: any) {
    return this.authnService.verifyRegistrationResponse(user, body)
  }

  @Post('/authentication')
  @HTTPDecorators.Bypass
  async newAuthentication() {
    return await this.authnService.generateAuthenticationOptions()
  }

  @Post('/authentication/verify')
  @HTTPDecorators.Bypass
  async verifyauthenticationAuthn(
    @IpLocation() ipLocation: IpRecord,
    @Body() body: any,
  ) {
    const result = await this.authnService.verifyAuthenticationResponse(body)
    if (result.verified && !body.test) {
      const user = await this.userService.getMaster()
      Object.assign(result, {
        token: await this.authService.jwtServicePublic.sign(user.id, {
          ip: ipLocation.ip,
          ua: ipLocation.agent,
        }),
      })
    }

    return result
  }

  @Get('/items')
  @Auth()
  @HTTPDecorators.Bypass
  async getAllAuthnItems() {
    return await this.authnService.getAllAuthnItems()
  }

  @Delete('/items/:id')
  @Auth()
  async deleteAuthnItem(@Param() params: MongoIdDto) {
    return await this.authnService.deleteAuthnItem(params.id)
  }
}
