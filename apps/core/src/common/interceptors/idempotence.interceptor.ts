import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { catchError, tap } from 'rxjs'

import {
  HTTP_IDEMPOTENCE_KEY,
  HTTP_IDEMPOTENCE_OPTIONS,
} from '~/constants/meta.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { getIp } from '~/utils/ip.util'
import { getRedisKey } from '~/utils/redis.util'
import { hashString } from '~/utils/tool.util'

const IdempotenceHeaderKey = 'x-idempotence'

export type IdempotenceOption = {
  errorMessage?: string
  pendingMessage?: string

  /**
   * Custom handler invoked when a duplicate request is detected.
   */
  handler?: (req: FastifyRequest) => any

  /**
   * How long (in seconds) the idempotence record is retained.
   * @default 60
   */
  expired?: number

  /**
   * How to derive the idempotence key from the request when no key
   * is provided in the header.
   */
  generateKey?: (req: FastifyRequest) => string

  /**
   * Only honor the header key; do not auto-generate one.
   * @default false
   */
  disableGenerateKey?: boolean
}

@Injectable()
export class IdempotenceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotenceInterceptor.name)

  constructor(
    private readonly redisService: RedisService,
    @Inject(REFLECTOR) private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()

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
      errorMessage = 'The same request can only be sent once within 60 seconds after success',
      pendingMessage = 'The same request is already being processed...',
      handler: errorHandler,
      expired = 60,
      disableGenerateKey = false,
    } = options
    const redis = this.redisService.getClient()

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
      try {
        const resultValue: '0' | '1' | null = (await redis.get(
          idempotenceKey,
        )) as any
        if (resultValue !== null) {
          if (errorHandler) {
            return await errorHandler(request)
          }

          const message = {
            1: errorMessage,
            0: pendingMessage,
          }[resultValue]
          throw new ConflictException(message)
        } else {
          await redis.set(idempotenceKey, '0', 'EX', expired)
        }
      } catch (err) {
        if (err instanceof ConflictException) throw err
        this.logger.warn(
          `Idempotence check failed, skipping: ${(err as Error).message}`,
        )
      }
    }
    return next.handle().pipe(
      tap(async () => {
        try {
          idempotenceKey && (await redis.set(idempotenceKey, '1', 'KEEPTTL'))
        } catch {
          // Redis failure on completion mark is non-critical
        }
      }),
      catchError(async (err) => {
        if (idempotenceKey) {
          await redis.del(idempotenceKey).catch(() => {})
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
