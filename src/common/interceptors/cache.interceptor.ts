/**
 * HttpCache interceptor.
 * @file 缓存拦截器
 * @module interceptor/cache
 * @author Surmon <https://github.com/surmon-china>
 * @author Innei <https://innei.ren>
 */
import { Observable, of } from 'rxjs'
import { tap } from 'rxjs/operators'

import {
  CallHandler,
  ExecutionContext,
  HttpAdapterHost,
  Inject,
  Injectable,
  NestInterceptor,
  RequestMethod,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { REDIS } from '~/app.config'
import * as META from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

/**
 * @class HttpCacheInterceptor
 * @classdesc 弥补框架不支持单独定义 ttl 参数以及单请求应用的缺陷
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheManager: CacheService,
    @Inject(SYSTEM.REFLECTOR) private readonly reflector: Reflector,
    @Inject(SYSTEM.HTTP_ADAPTER_HOST)
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  // 自定义装饰器，修饰 ttl 参数
  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    // 如果想彻底禁用缓存服务，则直接返回 -> return call$;
    const call$ = next.handle()

    if (REDIS.disableApiCache) {
      return call$
    }

    const request = this.getRequest(context)

    // 只有 GET 请求才会缓存
    if (request.method.toLowerCase() !== 'get') {
      return call$
    }

    const handler = context.getHandler()
    const isDisableCache = this.reflector.get(META.HTTP_CACHE_DISABLE, handler)
    const key = this.trackBy(context) || `mx-api-cache:${request.url}`

    if (isDisableCache) {
      return call$
    }

    const metaTTL = this.reflector.get(META.HTTP_CACHE_TTL_METADATA, handler)
    const ttl = metaTTL || REDIS.httpCacheTTL

    try {
      const value = await this.cacheManager.get(key)

      return value
        ? of(value)
        : call$.pipe(
            tap(
              (response) =>
                response && this.cacheManager.set(key, response, { ttl }),
            ),
          )
    } catch (error) {
      console.error(error)

      return call$
    }
  }

  /**
   * @function trackBy
   * @description 目前的命中规则是：必须手动设置了 CacheKey 才会启用缓存机制，默认 ttl 为 APP_CONFIG.REDIS.defaultCacheTTL
   */
  trackBy(context: ExecutionContext): string | undefined {
    const request = this.getRequest(context)
    const httpServer = this.httpAdapterHost.httpAdapter
    const isHttpApp = Boolean(httpServer?.getRequestMethod)
    const isGetRequest =
      isHttpApp &&
      httpServer.getRequestMethod(request) === RequestMethod[RequestMethod.GET]
    const cacheKey = this.reflector.get(
      META.HTTP_CACHE_KEY_METADATA,
      context.getHandler(),
    )
    const isMatchedCache = isHttpApp && isGetRequest && cacheKey
    return isMatchedCache ? cacheKey : undefined
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(this)
  }
}
