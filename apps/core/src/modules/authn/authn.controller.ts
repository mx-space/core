import { Body, Delete, Get, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { AuthService } from '../auth/auth.service'
import { UserDocument } from '../user/user.model'
import { AuthnService } from './authn.service'

@ApiController('/passkey')
export class AuthnController {
  constructor(
    private readonly authnService: AuthnService,
    private readonly authService: AuthService,
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
  @Auth()
  @HTTPDecorators.Bypass
  async newAuthentication(@CurrentUser() user: UserDocument) {
    return await this.authnService.generateAuthenticationOptions(user)
  }

  @Post('/authentication/verify')
  @HTTPDecorators.Bypass
  async verifyauthenticationAuthn(
    @CurrentUser() user: UserDocument,
    @IpLocation() ipLocation: IpRecord,
    @Body() body: any,
  ) {
    const result = await this.authnService.verifyAuthenticationResponse(body)
    if (result.verified) {
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
