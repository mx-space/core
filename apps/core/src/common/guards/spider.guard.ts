import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'

import { isDev } from '~/global/env.global'
import { AuthService } from '~/modules/auth/auth.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class SpiderGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isDev) {
      return true
    }

    const request = getNestExecutionContextRequest(context)
    const ua: string = (request.headers['user-agent'] as string) || ''
    const isSpiderUA =
      !!/scrapy|httpclient|axios|python|requests/i.test(ua) &&
      !/mx-space|rss|google|baidu|bing/i.test(ua)

    // Fast path: a well-formed, non-spider UA passes without auth lookups.
    // This is the common case for browsers, RSS readers, and the mx-space
    // CLI itself.
    if (ua && !isSpiderUA) {
      return true
    }

    // Slow path: UA is missing or looks like a scraper. Allow only if the
    // request carries valid owner credentials — header presence alone is not
    // enough (otherwise `Authorization: junk` would let any scraper through).
    if (await this.isAuthenticated(request)) {
      return true
    }

    throw new ForbiddenException(`Crawlers are not allowed, UA: ${ua}`)
  }

  private async isAuthenticated(
    request: ReturnType<typeof getNestExecutionContextRequest>,
  ): Promise<boolean> {
    const auth = request.headers.authorization
    const apiKeyHeader = request.headers['x-api-key']
    if (!auth && !apiKeyHeader) return false

    try {
      // Session (cookie or Bearer) → owner user.
      const session = await this.authService.getSessionUser(request.raw)
      if (session?.user?.role === 'owner') return true

      // API key (x-api-key header only).
      const apiKey = this.authService.getApiKeyFromRequest({
        headers: request.headers,
      })
      if (!apiKey) return false
      const verified = await this.authService.verifyApiKey(apiKey.key)
      if (!verified?.referenceId) return false
      // Match AuthGuard's policy: only owner-scoped API keys bypass guards.
      return await this.authService.isOwnerReaderId(verified.referenceId)
    } catch {
      // Any failure (DB blip, malformed token, etc.) → fall through to the
      // UA check rather than crashing the request.
      return false
    }
  }
}
