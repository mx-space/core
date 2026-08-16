import type { IncomingMessage, ServerResponse } from 'node:http'

import type { NestMiddleware, OnModuleInit } from '@nestjs/common'
import { Inject } from '@nestjs/common'

import {
  ConfigVersionScopes,
  ConfigVersionService,
} from '~/processors/redis/config-version.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { ConfigsService } from '../configs/configs.service'
import { AuthInstanceInjectKey } from './auth.constant'
import { CreateAuth } from './auth.implement'
import type { InjectAuthInstance } from './auth.interface'
import { ReviewDemoService } from './review-demo.service'
import { buildSocialProviders } from './social-providers'

declare module 'http' {
  interface IncomingMessage {
    originalUrl: string
  }
}

export class AuthMiddleware implements NestMiddleware, OnModuleInit {
  private authHandler: Awaited<ReturnType<typeof CreateAuth>>['handler']
  private reloadPromise?: Promise<void>
  private readonly appliedVersions = {
    [ConfigVersionScopes.OAuth]: 0,
    [ConfigVersionScopes.Url]: 0,
  }

  constructor(
    private readonly configVersionService: ConfigVersionService,
    private readonly configService: ConfigsService,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
    private readonly snowflakeService: SnowflakeService,
    private readonly reviewDemoService: ReviewDemoService,
  ) {}

  async onModuleInit() {
    await this.ensureAuthHandlerFresh(true)
  }

  private async ensureAuthHandlerFresh(force = false) {
    const currentVersions = await this.configVersionService.getVersions(
      [ConfigVersionScopes.OAuth, ConfigVersionScopes.Url] as const,
      this.appliedVersions,
    )
    const isStale =
      force ||
      !this.authHandler ||
      currentVersions.oauth !== this.appliedVersions.oauth ||
      currentVersions.url !== this.appliedVersions.url

    if (!isStale) {
      return
    }

    if (this.reloadPromise) {
      await this.reloadPromise
      return
    }

    this.reloadPromise = (async () => {
      const oauth = await this.configService.get('oauth')
      const urls = await this.configService.get('url')

      const providers = buildSocialProviders(oauth, urls.serverUrl)

      const parsedAdminUrl = new URL(urls.adminUrl)
      const passkeyOptions = {
        rpID: parsedAdminUrl.hostname,
        rpName: 'MixSpace',
        origin: isDev
          ? [
              parsedAdminUrl.origin,
              'http://localhost:9528',
              'http://127.0.0.1:9528',
              'http://localhost:2323',
              'http://127.0.0.1:2323',
            ]
          : parsedAdminUrl.origin,
      }

      const { handler, auth } = await CreateAuth(
        providers,
        passkeyOptions,
        urls.serverUrl,
        this.snowflakeService,
        () => this.reviewDemoService.getCredentialSignInGate(),
      )
      this.authHandler = handler

      this.authInstance.set(auth)
      Object.assign(this.appliedVersions, currentVersions)
    })().finally(() => {
      this.reloadPromise = undefined
    })

    await this.reloadPromise
  }

  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (!this.authHandler) {
      next()
      return
    }

    if (shouldBypassBetterAuth(req.originalUrl)) {
      next()
      return
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      next()
      return
    }

    await this.ensureAuthHandlerFresh()

    return await this.authHandler(req, res)
  }
}

export function shouldBypassBetterAuth(originalUrl: string) {
  const pathname = originalUrl.split('?')[0]?.replace(/\/+$/, '') || ''
  return /\/auth\/(?:token|session|providers|review-demo)$/.test(pathname)
}
