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

export const INLINE_DEVICE_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><%= siteTitle %> · Device authorization</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff; color: #1f1f1f; }
      .card { width: min(420px, calc(100% - 32px)); padding: 32px; border: 1px solid #e4e4e7; border-radius: 12px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      .subtitle { color: #6b6b6b; margin: 0 0 24px; font-size: 14px; }
      label { display: block; font-size: 13px; margin-bottom: 6px; color: #6b6b6b; }
      input[type=text] { width: 100%; padding: 12px 14px; font-size: 18px; letter-spacing: .12em; text-transform: uppercase; border: 1px solid #e4e4e7; border-radius: 8px; background: transparent; box-sizing: border-box; font-family: ui-monospace, Menlo, monospace; }
      .row { display: flex; gap: 12px; margin-top: 20px; }
      button { flex: 1; padding: 12px 16px; font-size: 15px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
      button.primary { background: #2563eb; color: white; }
      button.ghost { background: transparent; color: #1f1f1f; border-color: #e4e4e7; }
      button[disabled] { opacity: .6; cursor: not-allowed; }
      .status { margin-top: 18px; font-size: 14px; min-height: 20px; }
      .status.ok { color: #2563eb; }
      .status.err { color: #dc2626; }
      .user { margin-top: 18px; font-size: 13px; color: #6b6b6b; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1><%= siteTitle %></h1>
      <p class="subtitle">Authorize this device to access your account.</p>
      <form id="device-form">
        <label for="user_code">User code</label>
        <input id="user_code" name="user_code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" value="<%= userCode %>" required />
        <div class="row">
          <button type="submit" class="primary" data-action="approve">Approve</button>
          <button type="button" class="ghost" data-action="deny">Deny</button>
        </div>
      </form>
      <p id="status" class="status" role="status" aria-live="polite"></p>
      <p class="user">Signed in as <%= user.email || user.name || user.id %></p>
    </main>
    <script>
      (function () {
        const form = document.getElementById('device-form')
        const status = document.getElementById('status')
        const verifyUrl = <%- JSON.stringify(verifyUrl) %>
        const buttons = form.querySelectorAll('button')
        function setStatus(message, kind) { status.textContent = message; status.className = 'status' + (kind ? ' ' + kind : '') }
        function setBusy(busy) { buttons.forEach(function (b) { b.disabled = busy }) }
        async function send(action) {
          const userCode = form.user_code.value.trim()
          if (!userCode) { setStatus('User code is required.', 'err'); return }
          setBusy(true); setStatus('Submitting…')
          try {
            const res = await fetch(verifyUrl, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_code: userCode, action: action }) })
            const body = await res.json().catch(function () { return null })
            if (!res.ok || !body || body.ok === false) {
              const msg = (body && (body.message || body.error_description)) || 'Request failed.'
              setStatus(msg, 'err'); return
            }
            setStatus(action === 'approve' ? 'Device approved. You can return to your terminal.' : 'Device denied.', 'ok')
          } catch (err) { setStatus(err && err.message ? err.message : 'Network error.', 'err') } finally { setBusy(false) }
        }
        form.addEventListener('submit', function (e) { e.preventDefault(); send('approve') })
        form.querySelector('[data-action="deny"]').addEventListener('click', function () { send('deny') })
      })()
    </script>
  </body>
</html>
`

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
    try {
      const template = (await this.assetService.getAsset('/render/device.ejs', {
        encoding: 'utf-8',
      })) as string
      if (typeof template === 'string' && template.length > 0) {
        return template
      }
    } catch {}
    return INLINE_DEVICE_TEMPLATE
  }

  private async resolveSiteTitle(): Promise<string> {
    try {
      const seo = await this.configsService.get('seo')
      const title = (seo as { title?: string } | undefined)?.title
      if (typeof title === 'string' && title.length > 0) {
        return title
      }
    } catch {}
    return 'mx-space'
  }
}
