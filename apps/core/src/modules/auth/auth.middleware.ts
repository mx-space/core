import type { IncomingMessage, ServerResponse } from 'node:http'

import type { NestMiddleware, OnModuleInit } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import type { BetterAuthOptions } from 'better-auth'

import {
  ConfigVersionScopes,
  ConfigVersionService,
} from '~/processors/redis/config-version.service'

import { ConfigsService } from '../configs/configs.service'
import { AuthInstanceInjectKey } from './auth.constant'
import { CreateAuth } from './auth.implement'
import type { InjectAuthInstance } from './auth.interface'

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

      const providers = {} as NonNullable<BetterAuthOptions['socialProviders']>
      await Promise.all(
        (oauth.providers || []).map(async (provider) => {
          if (!provider.enabled) return
          const type = provider.type as string

          const mergedConfig = {
            ...oauth.public?.[type],
            ...oauth.secrets?.[type],
          }
          switch (type) {
            case 'github': {
              if (!mergedConfig.clientId || !mergedConfig.clientSecret) return

              providers.github = {
                clientId: mergedConfig.clientId,
                clientSecret: mergedConfig.clientSecret,
                redirectURI: `${urls.serverUrl}/auth/callback/github`,
                mapProfileToUser: (profile) => {
                  return {
                    handle: profile.login,
                  }
                },
              }
              break
            }

            case 'google': {
              if (!mergedConfig.clientId || !mergedConfig.clientSecret) return

              providers.google = {
                clientId: mergedConfig.clientId,
                clientSecret: mergedConfig.clientSecret,
                redirectURI: `${urls.serverUrl}/auth/callback/google`,
              }

              break
            }
          }
        }),
      )

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

      const { handler, auth } = await CreateAuth(providers, passkeyOptions)
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

    const bypassPath = ['/token', '/session', '/providers']

    if (bypassPath.some((path) => req.originalUrl.includes(path))) {
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
