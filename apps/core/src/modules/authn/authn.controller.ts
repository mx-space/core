import {
  Body,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import type { FastifyReply } from 'fastify'
import { AuthInstanceInjectKey } from '../auth/auth.constant'
import type { InjectAuthInstance } from '../auth/auth.interface'

@ApiController('/passkey')
export class AuthnController {
  constructor(
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
  ) {}

  @Post('/register')
  @HTTPDecorators.Bypass
  @Auth()
  async newAuthn(@Req() req: FastifyBizRequest) {
    const headers = this.buildHeaders(req)
    const options = await this.authInstance
      .get()
      .api.generatePasskeyRegistrationOptions({
        headers,
      })
    return { deprecated: true, ...options }
  }

  @Post('/register/verify')
  @HTTPDecorators.Bypass
  @Auth()
  async responseAuthn(@Req() req: FastifyBizRequest, @Body() body: any) {
    const headers = this.buildHeaders(req)
    const response = body?.response ?? body
    const result = await this.authInstance.get().api.verifyPasskeyRegistration({
      headers,
      body: {
        response,
        name: body?.name,
      },
    })
    return { deprecated: true, ...result }
  }

  @Post('/authentication')
  @HTTPDecorators.Bypass
  async newAuthentication(@Req() req: FastifyBizRequest) {
    const headers = this.buildHeaders(req)
    const options = await this.authInstance
      .get()
      .api.generatePasskeyAuthenticationOptions({
        headers,
      })
    return { deprecated: true, ...options }
  }

  @Post('/authentication/verify')
  @HTTPDecorators.Bypass
  async verifyauthenticationAuthn(
    @Req() req: FastifyBizRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: any,
  ) {
    const headers = this.buildHeaders(req)
    const response = body?.response ?? body
    const result = await this.authInstance
      .get()
      .api.verifyPasskeyAuthentication({
        headers,
        body: { response },
        returnHeaders: true,
      })
    const setCookie = result.headers?.get('set-cookie')
    if (setCookie) {
      reply.header('set-cookie', setCookie)
    }
    return { deprecated: true, ...result.response }
  }

  @Get('/items')
  @Auth()
  @HTTPDecorators.Bypass
  async getAllAuthnItems(@Req() req: FastifyBizRequest) {
    const headers = this.buildHeaders(req)
    const result = await this.authInstance.get().api.listPasskeys({ headers })
    return { deprecated: true, items: result }
  }

  @Delete('/items/:id')
  @Auth()
  async deleteAuthnItem(
    @Req() req: FastifyBizRequest,
    @Param() params: MongoIdDto,
  ) {
    const headers = this.buildHeaders(req)
    const result = await this.authInstance.get().api.deletePasskey({
      headers,
      body: {
        id: params.id,
      },
    })
    return { deprecated: true, ...result }
  }

  private buildHeaders(req: FastifyBizRequest) {
    const headers = new Headers()
    const cookie = req.raw?.headers.cookie
    if (cookie) {
      headers.set('cookie', cookie)
    }
    const origin = req.raw?.headers.origin
    if (typeof origin === 'string') {
      headers.set('origin', origin)
    }
    return headers
  }
}
