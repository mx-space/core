import type { NestMiddleware, OnModuleInit } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'

import {
  AuthConfig,
  authjs,
  BuiltInProviderType,
} from '@mx-space/complied/auth'
import { Inject } from '@nestjs/common'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'

import { ConfigsService } from '../configs/configs.service'
import { AuthConfigInjectKey } from './auth.constant'
import { CreateAuth, ServerAuthConfig } from './auth.implement'

declare module 'http' {
  interface IncomingMessage {
    originalUrl: string
  }
}

const github = authjs.providers.github

export class AuthMiddleware implements NestMiddleware, OnModuleInit {
  private authHandler: ReturnType<typeof CreateAuth>
  constructor(
    @Inject(AuthConfigInjectKey) private readonly config: ServerAuthConfig,
    private readonly redisSub: SubPubBridgeService,
    private readonly configService: ConfigsService,
  ) {}

  async onModuleInit() {
    const handler = async () => {
      const oauth = await this.configService.get('oauth')

      const providers = [] as AuthConfig['providers']
      oauth.providers.forEach((provider) => {
        if (!provider.enabled) return
        const type = provider.type as BuiltInProviderType

        const mergedConfig = {
          ...oauth.public[type],
          ...oauth.secrets[type],
        }
        switch (type) {
          case 'github': {
            if (!mergedConfig.clientId || !mergedConfig.clientSecret) return
            const provider = github({
              clientId: mergedConfig.clientId,
              clientSecret: mergedConfig.clientSecret,
              // allowDangerousEmailAccountLinking: true,
              profile(profile) {
                return {
                  id: profile.id.toString(),

                  email: profile.email,
                  name: profile.name || profile.login,
                  handle: profile.login,
                  image: profile.avatar_url,
                  isOwner: false,
                }
              },
            })
            providers.push(provider)
            break
          }

          case 'google': {
            if (!mergedConfig.clientId || !mergedConfig.clientSecret) return

            const provider = authjs.providers.google({
              clientId: mergedConfig.clientId,
              clientSecret: mergedConfig.clientSecret,
              profile(profile) {
                return {
                  id: profile.sub,
                  email: profile.email,
                  name: profile.name,
                  handle: profile.email,
                  image: profile.picture,
                  isOwner: false,
                }
              },
            })

            providers.push(provider)

            break
          }
        }
      })

      this.config.providers = providers
      this.authHandler = CreateAuth(this.config)
    }
    this.redisSub.subscribe(EventBusEvents.OauthChanged, handler)
    await handler()
  }

  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (!this.authHandler) {
      next()
      return
    }

    const bypassPath = ['/token', '/session']

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
