import type { IncomingMessage, ServerResponse } from 'node:http'
import type { NestMiddleware, OnModuleInit } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import type { BetterAuthOptions } from 'better-auth'
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

  constructor(
    private readonly redisSub: SubPubBridgeService,
    private readonly configService: ConfigsService,
    @Inject(AuthInstanceInjectKey)
    private readonly authInstance: InjectAuthInstance,
  ) {}

  async onModuleInit() {
    const handler = async () => {
      const oauth = await this.configService.get('oauth')

      const providers = {} as NonNullable<BetterAuthOptions['socialProviders']>
      await Promise.all(
        (oauth.providers || []).map(async (provider) => {
          if (!provider.enabled) return
          const type = provider.type as string

          const mergedConfig = {
            ...(oauth.public?.[type] || {}),
            ...(oauth.secrets?.[type] || {}),
          }
          const urls = await this.configService.get('url')
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

      const { handler, auth } = await CreateAuth(providers)
      this.authHandler = handler

      this.authInstance.set(auth)
    }
    this.redisSub.subscribe(EventBusEvents.OauthChanged, handler)
    this.redisSub.subscribe(EventBusEvents.AppUrlChanged, handler)

    await handler()
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

    return await this.authHandler(req, res)
  }
}
