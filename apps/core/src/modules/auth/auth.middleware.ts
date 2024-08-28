import type { NestMiddleware, OnModuleInit } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { AuthConfig, authjs } from '@mx-space/complied/auth'
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
  ) {
    if (this.config.providers.length) this.authHandler = CreateAuth(this.config)
  }

  onModuleInit() {
    this.redisSub.subscribe(EventBusEvents.OauthChanged, async () => {
      const oauth = await this.configService.get('oauth')

      const providers = [] as AuthConfig['providers']
      oauth.providers.forEach((provider) => {
        if (!provider.enabled) return
        const type = provider.type

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
            })
            providers.push(provider)
          }
        }
      })

      this.config.providers = providers
      this.authHandler = CreateAuth(this.config)
    })
  }

  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (!this.authHandler) {
      next()
      return
    }

    if (req.originalUrl.includes('/auth/token')) {
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
