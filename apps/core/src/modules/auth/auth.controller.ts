import { Transform } from 'class-transformer'
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  isMongoId,
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
import { EventBusEvents } from '~/constants/event-bus.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'

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
}
