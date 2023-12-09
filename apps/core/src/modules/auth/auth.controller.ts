import { Transform } from 'class-transformer'
import {
  IsDate,
  isMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'

import {
  Body,
  Delete,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { UserDocument } from '../user/user.model'
import { AuthService } from './auth.service'

export class TokenDto {
  @IsDate()
  @IsOptional()
  @Transform(({ value: v }) => new Date(v))
  expired?: Date

  @IsString()
  @IsNotEmpty()
  name: string
}
@ApiController({
  path: 'auth',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('token')
  @Auth()
  async getOrVerifyToken(
    @Query('token') token?: string,
    @Query('id') id?: string,
  ) {
    if (typeof token === 'string') {
      return await this.authService
        .verifyCustomToken(token)
        .then(([isValid]) => isValid)
    }
    if (id && typeof id === 'string' && isMongoId(id)) {
      return await this.authService.getTokenSecret(id)
    }
    return await this.authService.getAllAccessToken()
  }

  @Post('token')
  @Auth()
  async generateToken(@Body() body: TokenDto) {
    const { expired, name } = body
    const token = await this.authService.generateAccessToken()
    const model = {
      expired,
      token,
      name,
    }
    await this.authService.saveToken(model)
    return model
  }

  @Delete('token')
  @Auth()
  async deleteToken(@Query() query: MongoIdDto) {
    const { id } = query
    const token = await this.authService
      .getAllAccessToken()
      .then((models) =>
        models.find((model) => {
          return (model as any).id === id
        }),
      )
      .then((model) => {
        return model?.token
      })

    if (!token) {
      throw new NotFoundException(`token ${id} is not found`)
    }
    await this.authService.deleteToken(id)

    this.eventEmitter.emit(EventBusEvents.TokenExpired, token)
    return 'OK'
  }

  @Post('/authn/register')
  @HTTPDecorators.Bypass
  @Auth()
  async newAuthn(@CurrentUser() user: UserDocument) {
    const r = await this.authService.generateRegistrationOptions(user)
    return r.registrationOptions
  }

  @Post('/authn/register/verify')
  @HTTPDecorators.Bypass
  @Auth()
  async responseAuthn(@CurrentUser() user: UserDocument, @Body() body: any) {
    return this.authService.verifyRegistrationResponse(user, body)
  }

  @Post('/authn/authentication')
  @Auth()
  @HTTPDecorators.Bypass
  async newAuthentication(@CurrentUser() user: UserDocument) {
    return await this.authService.generateAuthenticationOptions(user)
  }

  @Post('/authn/authentication/verify')
  @HTTPDecorators.Bypass
  async verifyauthenticationAuthn(
    @CurrentUser() user: UserDocument,
    @IpLocation() ipLocation: IpRecord,
    @Body() body: any,
  ) {
    const result = await this.authService.verifyAuthenticationResponse(body)
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

  @Get()
  @Auth()
  async getAllAuthnItems() {
    return await this.authService.getAllAuthnItems()
  }
}
