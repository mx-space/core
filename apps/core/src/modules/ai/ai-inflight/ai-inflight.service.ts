import { Injectable, Logger } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { isDev } from '~/global/env.global'
import { RedisService } from '~/processors/redis/redis.service'
import { sleep } from '~/utils/tool.util'
import type { AiInFlightOptions, AiStreamEvent } from './ai-inflight.types'

@Injectable()
export class AiInFlightService {
  private readonly logger = new Logger(AiInFlightService.name)
  constructor(private readonly redisService: RedisService) {}

  private buildKeys(key: string) {
    const prefix = `ai:stream:${key}`
    return {
      lockKey: `${prefix}:lock`,
      streamKey: `${prefix}:stream`,
      resultKey: `${prefix}:result`,
      errorKey: `${prefix}:error`,
    }
  }

  async runWithStream<T>(options: AiInFlightOptions<T>): Promise<{
    role: 'leader' | 'follower'
    events: AsyncIterable<AiStreamEvent>
    result: Promise<T>
  }> {
    const redis = this.redisService.getClient()
    const { lockKey, streamKey, resultKey, errorKey } = this.buildKeys(
      options.key,
    )

    const existingResultId = await redis.get(resultKey)
    if (existingResultId) {
      if (isDev) {
        this.logger.debug(`inflight result hit key=${options.key}`)
      }
      return {
        role: 'follower',
        events: this.createImmediateDoneStream(existingResultId),
        result: options.parseResult(existingResultId),
      }
    }

    const instanceId = `${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
    const lockResult = await redis.set(
      lockKey,
      instanceId,
      'EX',
      options.lockTtlSec,
      'NX',
    )

    if (lockResult === 'OK') {
      if (isDev) {
        this.logger.debug(`inflight leader key=${options.key}`)
      }
      const heartbeat = setInterval(
        () => {
          redis.expire(lockKey, options.lockTtlSec)
        },
        Math.max(1000, Math.floor(options.lockTtlSec * 500)),
      )

      const leaderResult = this.executeLeader(options, {
        streamKey,
        resultKey,
        errorKey,
      }).finally(() => clearInterval(heartbeat))

      return {
        role: 'leader',
        events: this.createStreamReader(options, {
          streamKey,
          resultKey,
          errorKey,
          lockKey,
        }),
        result: leaderResult,
      }
    }

    if (isDev) {
      this.logger.debug(`inflight follower key=${options.key}`)
    }
    return {
      role: 'follower',
      events: this.createStreamReader(options, {
        streamKey,
        resultKey,
        errorKey,
        lockKey,
      }),
      result: this.waitForResult(options, { resultKey, errorKey, lockKey }),
    }
  }

  private async executeLeader<T>(
    options: AiInFlightOptions<T>,
    keys: { streamKey: string; resultKey: string; errorKey: string },
  ): Promise<T> {
    const redis = this.redisService.getClient()
    try {
      const { result, resultId } = await options.onLeader({
        push: async (event) => {
          await redis.xadd(
            keys.streamKey,
            'MAXLEN',
            '~',
            options.streamMaxLen,
            '*',
            'type',
            event.type,
            'data',
            JSON.stringify(event.data),
          )
          if (isDev) {
            const dataSize =
              typeof event.data === 'string'
                ? event.data.length
                : JSON.stringify(event.data).length
            this.logger.debug(
              `inflight xadd key=${options.key} type=${event.type} size=${dataSize}`,
            )
          }
        },
      })

      await redis.set(keys.resultKey, resultId, 'EX', options.resultTtlSec)
      await redis.xadd(
        keys.streamKey,
        'MAXLEN',
        '~',
        options.streamMaxLen,
        '*',
        'type',
        'done',
        'data',
        JSON.stringify({ resultId }),
      )
      await redis.expire(keys.streamKey, options.resultTtlSec)
      return result
    } catch (error) {
      const message = (error as Error)?.message || 'Unknown AI error'
      await redis.set(keys.errorKey, message, 'EX', options.resultTtlSec)
      await redis.xadd(
        keys.streamKey,
        'MAXLEN',
        '~',
        options.streamMaxLen,
        '*',
        'type',
        'error',
        'data',
        JSON.stringify({ message }),
      )
      await redis.expire(keys.streamKey, options.resultTtlSec)
      throw error
    }
  }

  private async *createImmediateDoneStream(
    resultId: string,
  ): AsyncIterable<AiStreamEvent> {
    yield { type: 'done', data: { resultId } }
  }

  private async *createStreamReader<T>(
    options: AiInFlightOptions<T>,
    keys: {
      streamKey: string
      resultKey: string
      errorKey: string
      lockKey: string
    },
  ): AsyncIterable<AiStreamEvent> {
    const redis = this.redisService.getClient()
    let lastId = '0-0'
    const startAt = Date.now()

    let lastEventAt = 0
    while (true) {
      const now = Date.now()
      const activeBlockMs =
        options.readBlockMs > 100
          ? Math.max(50, Math.floor(options.readBlockMs / 2))
          : options.readBlockMs
      const blockMs =
        lastEventAt && now - lastEventAt < 1000
          ? activeBlockMs
          : options.readBlockMs
      const response = await redis.xread(
        'BLOCK',
        blockMs,
        'STREAMS',
        keys.streamKey,
        lastId,
      )

      if (!response) {
        const resultId = await redis.get(keys.resultKey)
        if (resultId) {
          yield { type: 'done', data: { resultId } }
          return
        }

        const errorMessage = await redis.get(keys.errorKey)
        if (errorMessage) {
          yield { type: 'error', data: { message: errorMessage } }
          return
        }

        const lockExists = await redis.exists(keys.lockKey)
        if (!lockExists) {
          throw new BizException(
            ErrorCodeEnum.AIException,
            'AI stream ended without result',
          )
        }

        if (Date.now() - startAt > options.idleTimeoutMs) {
          throw new BizException(
            ErrorCodeEnum.AIException,
            'AI stream idle timeout',
          )
        }

        continue
      }

      for (const [, entries] of response) {
        if (isDev) {
          this.logger.debug(
            `inflight xread key=${options.key} count=${entries.length}`,
          )
        }
        for (const [id, fields] of entries) {
          lastId = id
          lastEventAt = Date.now()
          const event = this.parseStreamEvent(fields)
          yield event
          if (event.type === 'done' || event.type === 'error') {
            return
          }
        }
      }
    }
  }

  private parseStreamEvent(fields: string[]): AiStreamEvent {
    const record: Record<string, string> = {}
    for (let i = 0; i < fields.length; i += 2) {
      record[fields[i]] = fields[i + 1]
    }

    const rawData = record.data ?? 'null'
    const data = JSON.parse(rawData)
    const type = record.type as AiStreamEvent['type']

    if (type === 'token') {
      return { type, data: data as string }
    }

    if (type === 'done') {
      return { type, data: data as { resultId: string } }
    }

    return { type: 'error', data: data as { message: string } }
  }

  private async waitForResult<T>(
    options: AiInFlightOptions<T>,
    keys: { resultKey: string; errorKey: string; lockKey: string },
  ): Promise<T> {
    const redis = this.redisService.getClient()
    const startAt = Date.now()

    while (true) {
      const resultId = await redis.get(keys.resultKey)
      if (resultId) {
        return options.parseResult(resultId)
      }

      const errorMessage = await redis.get(keys.errorKey)
      if (errorMessage) {
        throw new BizException(ErrorCodeEnum.AIException, errorMessage)
      }

      const lockExists = await redis.exists(keys.lockKey)
      if (!lockExists) {
        throw new BizException(
          ErrorCodeEnum.AIException,
          'AI processing ended without result',
        )
      }

      if (Date.now() - startAt > options.idleTimeoutMs) {
        throw new BizException(
          ErrorCodeEnum.AIException,
          'AI processing idle timeout',
        )
      }

      await sleep(100)
    }
  }
}
