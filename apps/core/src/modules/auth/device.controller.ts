import {
  Body,
  Get,
  Headers as RequestHeaders,
  Inject,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import ejs from 'ejs'
import type { FastifyReply } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { API_VERSION } from '~/app.config'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { isDev } from '~/global/env.global'
import { ConfigsService } from '~/modules/configs/configs.service'
import { AssetService } from '~/processors/helper/helper.asset.service'

import { AuthInstanceInjectKey } from './auth.constant'
import type { InjectAuthInstance } from './auth.interface'
import { AuthService } from './auth.service'

const DeviceVerifyBodySchema = z.object({
  user_code: z.string().min(1),
  action: z.enum(['approve', 'deny']),
})

export class DeviceVerifyDto extends createZodDto(DeviceVerifyBodySchema) {}

const deviceBasePath = isDev ? '/device' : `/api/v${API_VERSION}/device`
const adminLoginPath = '/proxy/qaqdmin/#/login'

@ApiController('device')
@SkipThrottle()
export class DeviceController {
  constructor(
    private readonly assetService: AssetService,
    private readonly authService: AuthService,
    private readonly configsService: ConfigsService,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
  ) {}

  @Get('/')
  @HTTPDecorators.Bypass
  async page(
    @Query('user_code') userCode: string | undefined,
    @RequestHeaders('cookie') cookie: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const headers = new Headers()
    if (cookie) headers.set('cookie', cookie)
    const session = await this.authService.getSessionUserFromHeaders(headers)
    const user = session?.user

    if (!user || user.role !== 'owner') {
      const returnUrl = `${deviceBasePath}${userCode ? `?user_code=${encodeURIComponent(userCode)}` : ''}`
      const redirect = `${adminLoginPath}?redirect=${encodeURIComponent(returnUrl)}`
      return reply.redirect(redirect, 302)
    }

    if (userCode) {
      const auth = this.authInstance.get()
      if (!auth) {
        throw new BizException(ErrorCodeEnum.AuthFailed, 'auth not initialised')
      }
      await auth.api.deviceVerify({
        query: { user_code: userCode.trim() },
        headers,
      })
    }

    const html = await this.renderPage({
      userCode: userCode ?? '',
      user,
      siteTitle: await this.resolveSiteTitle(),
    })
    return reply.type('text/html').send(html)
  }

  @Post('verify')
  @HTTPDecorators.Bypass
  async verify(
    @Body() body: DeviceVerifyDto,
    @RequestHeaders('cookie') cookie: string | undefined,
  ) {
    const headers = new Headers()
    if (cookie) headers.set('cookie', cookie)
    const session = await this.authService.getSessionUserFromHeaders(headers)
    if (!session?.user || session.user.role !== 'owner') {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    const auth = this.authInstance.get()
    if (!auth) {
      throw new BizException(ErrorCodeEnum.AuthFailed, 'auth not initialised')
    }

    const userCode = body.user_code.trim()
    try {
      if (body.action === 'approve') {
        await auth.api.deviceApprove({ body: { userCode }, headers })
      } else {
        await auth.api.deviceDeny({ body: { userCode }, headers })
      }
    } catch (error) {
      const errAny = error as {
        status?: number | string
        body?: { error?: string; error_description?: string }
        message?: string
      }
      const description =
        errAny?.body?.error_description ||
        errAny?.body?.error ||
        errAny?.message ||
        'device verification failed'
      return {
        ok: false,
        code: errAny?.body?.error ?? 'device.verify.failed',
        message: description,
      }
    }

    return { ok: true, action: body.action }
  }

  private async renderPage(props: {
    userCode: string
    user: { id?: string; email?: string | null; name?: string | null }
    siteTitle: string
  }) {
    const template = await this.loadTemplate()
    return ejs.render(template, {
      ...props,
      verifyUrl: `${deviceBasePath}/verify`,
    })
  }

  private async loadTemplate(): Promise<string> {
    const template = (await this.assetService.getAsset('/render/device.ejs', {
      encoding: 'utf-8',
    })) as string
    if (typeof template !== 'string' || template.length === 0) {
      throw new BizException(
        ErrorCodeEnum.AuthFailed,
        'device template missing',
      )
    }
    return template
  }

  private async resolveSiteTitle(): Promise<string> {
    try {
      const seo = await this.configsService.get('seo')
      const title = (seo as { title?: string } | undefined)?.title
      if (typeof title === 'string' && title.length > 0) {
        return title
      }
    } catch {
      // fallthrough to default
    }
    return 'mx-space'
  }
}
