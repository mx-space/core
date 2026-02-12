import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Inject, Injectable, Logger, RequestMethod } from '@nestjs/common'
import { HttpAdapterHost, Reflector } from '@nestjs/core'
import { HTTP_CACHE, REDIS } from '~/app.config'
import { API_CACHE_PREFIX } from '~/constants/cache.constant'
import * as META from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { isTest } from '~/global/env.global'
import { CacheService } from '~/processors/redis/cache.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { hashString } from '~/utils/tool.util'
import type { FastifyReply } from 'fastify'
import { Observable, of, tap } from 'rxjs'

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name)

  constructor(
    private readonly cacheManager: CacheService,
    @Inject(SYSTEM.REFLECTOR) private readonly reflector: Reflector,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    const call$ = next.handle()

    if (REDIS.disableApiCache || isTest) {
      return call$
    }

    const request = this.getRequest(context)
    const res = context.switchToHttp().getResponse<FastifyReply>()

    const cacheOptions = this.reflector.get(
      META.HTTP_CACHE_META_OPTIONS,
      context.getHandler(),
    )

    if (request.isAuthenticated && !cacheOptions?.force) {
      this.setPrivateCacheHeader(res)
      return call$
    }

    if (request.method.toLowerCase() !== 'get') {
      return call$
    }

    const query: any = request.query || {}
    if (query.ts || query.timestamp || query._t || query.t) {
      return call$
    }

    const handler = context.getHandler()

    if (this.reflector.get(META.HTTP_CACHE_DISABLE, handler)) {
      return call$
    }

    const key = this.trackBy(context)
    const metaTTL = this.reflector.get(META.HTTP_CACHE_TTL_METADATA, handler)
    const ttl = metaTTL || HTTP_CACHE.ttl

    try {
      const value = await this.cacheManager.get(key)

      if (value) {
        this.logger.debug(`hit cache:${key}`)
        this.setCacheHeader(res, ttl)
      }

      return value
        ? of(value)
        : call$.pipe(
            tap((response) => {
              if (response) {
                this.cacheManager.set(key, response, ttl * 1000)
              }
              this.setCacheHeader(res, ttl)
            }),
          )
    } catch (error) {
      console.error(error)
      return call$
    }
  }

  private setPrivateCacheHeader(res: FastifyReply) {
    if (res.raw.statusCode !== 200) return
    const cacheValue = 'private, max-age=0, no-cache, no-store, must-revalidate'
    res.header('cdn-cache-control', cacheValue)
    res.header('cache-control', cacheValue)
    res.header('cloudflare-cdn-cache-control', cacheValue)
  }

  private setCacheHeader(res: FastifyReply, ttl: number) {
    if (res.raw.statusCode !== 200) return
    res.header('x-mx-cache', 'hit')

    if (HTTP_CACHE.enableCDNHeader) {
      const cdnValue = `max-age=${ttl}, stale-while-revalidate=60`
      res.header('cdn-cache-control', cdnValue)
      res.header('Cloudflare-CDN-Cache-Control', cdnValue)
    }

    if (res.getHeader('cache-control')) {
      return
    }

    const parts: string[] = []
    if (HTTP_CACHE.enableForceCacheHeader) {
      parts.push(`max-age=${ttl}`)
    }
    if (HTTP_CACHE.enableCDNHeader) {
      parts.push(`s-maxage=${ttl}, stale-while-revalidate=60`)
    }

    if (parts.length > 0) {
      res.header('cache-control', parts.join(', '))
    }
  }

  private trackBy(context: ExecutionContext): string {
    const request = this.getRequest(context)
    const httpServer = this.httpAdapterHost.httpAdapter
    const isGetRequest =
      request &&
      httpServer.getRequestMethod(request) === RequestMethod[RequestMethod.GET]
    const cacheKey = this.reflector.get(
      META.HTTP_CACHE_KEY_METADATA,
      context.getHandler(),
    )
    const originalKey =
      isGetRequest && cacheKey ? cacheKey : this.fallbackKey(context)
    return this.transformCacheKey(originalKey, context)
  }

  private transformCacheKey(key: string, context: ExecutionContext): string {
    const cacheOptions = this.reflector.get(
      META.HTTP_CACHE_META_OPTIONS,
      context.getHandler(),
    )
    if (!cacheOptions?.withQuery) {
      return key
    }

    const queryString = this.getRequest(context).url.split('?')[1]
    return queryString ? `${key}?${hashString(queryString)}` : key
  }

  private fallbackKey(context: ExecutionContext): string {
    return `${API_CACHE_PREFIX}${this.getRequest(context).url}`
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(
      this,
    ) as typeof getNestExecutionContextRequest
  }
}
