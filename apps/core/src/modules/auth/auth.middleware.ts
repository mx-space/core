import type { NestMiddleware } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { Inject } from '@nestjs/common'

import { AuthConfigInjectKey } from './auth.constant'
import { CreateAuth, ServerAuthConfig } from './auth.implement'

declare module 'http' {
  interface IncomingMessage {
    originalUrl: string
  }
}
export class AuthMiddleware implements NestMiddleware {
  private authHandler: ReturnType<typeof CreateAuth>
  constructor(
    @Inject(AuthConfigInjectKey) private readonly config: ServerAuthConfig,
  ) {
    if (this.config.providers.length) this.authHandler = CreateAuth(this.config)
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
