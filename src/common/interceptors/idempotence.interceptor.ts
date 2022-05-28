import { FastifyRequest } from 'fastify'
import { catchError } from 'rxjs'

import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
  HTTP_IDEMPOTENCE_KEY,
  HTTP_IDEMPOTENCE_OPTIONS,
} from '~/constants/meta.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getIp, getRedisKey, hashString } from '~/utils'

const IdempotenceHeaderKey = 'x-idempotence'

export type IdempotenceOption = {
  errorMessage?: string

  /**
   * 如果重复请求的话，手动处理异常
   */
  handler?: (req: FastifyRequest) => any

  /**
   * 记录重复请求的时间
   * @default 60
   */
  expired?: number

  /**
   * 如果 header 没有幂等 key，根据 request 生成 key，如何生成这个 key 的方法
   */
  generateKey?: (req: FastifyRequest) => string

  /**
   * 仅读取 header 的 key，不自动生成
   * @default false
   */
  disableGenerateKey?: boolean
}

@Injectable()
export class IdempotenceInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    @Inject(REFLECTOR) private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()

    // skip Get 请求
    if (request.method.toUpperCase() === 'GET') {
      return next.handle()
    }

    const handler = context.getHandler()
    const options: IdempotenceOption | undefined = this.reflector.get(
      HTTP_IDEMPOTENCE_OPTIONS,
      handler,
    )

    if (!options) {
      return next.handle()
    }

    const {
      errorMessage = '相同请求成功后在 60 秒内只能发送一次',
      handler: errorHandler,
      expired = 60,
      disableGenerateKey = false,
    } = options
    const redis = this.cacheService.getClient()

    const idempotence = request.headers[IdempotenceHeaderKey] as string
    const key = disableGenerateKey
      ? undefined
      : options.generateKey
      ? options.generateKey(request)
      : this.generateKey(request)

    const idempotenceKey =
      !!(idempotence || key) && getRedisKey(`idempotence:${idempotence || key}`)

    SetMetadata(HTTP_IDEMPOTENCE_KEY, idempotenceKey)(handler)

    if (idempotenceKey) {
      if (await redis.get(idempotenceKey).then((val) => val === '1')) {
        if (errorHandler) {
          return await errorHandler(request)
        }
        throw new ConflictException(errorMessage)
      } else {
        await redis.set(idempotenceKey, '1')
        await redis.expire(idempotenceKey, expired)
      }
    }
    return next.handle().pipe(
      catchError(async (err) => {
        if (idempotenceKey) {
          await redis.del(idempotenceKey)
        }
        throw err
      }),
    )
  }

  private generateKey(req: FastifyRequest) {
    const { body, params, query = {}, headers, url } = req

    const obj = { body, url, params, query } as any

    const uuid = headers['x-uuid']
    if (uuid) {
      obj.uuid = uuid
    } else {
      const ua = headers['user-agent']
      const ip = getIp(req)

      if (!ua && !ip) {
        return undefined
      }
      Object.assign(obj, { ua, ip })
    }

    return hashString(JSON.stringify(obj))
  }
}
