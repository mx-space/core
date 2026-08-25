import { Injectable, Logger } from '@nestjs/common'
import { delay } from 'es-toolkit'

import { AppErrorCode, createAppException } from '~/common/errors'
import { isDev } from '~/global/env.global'
import { RedisService } from '~/processors/redis/redis.service'

import type { AiInFlightOptions, AiStreamEvent } from './ai-inflight.types'

@Injectable()
export class AiInFlightService {
  private readonly logger = new Logger(AiInFlightService.name)
  constructor(private readonly redisService: RedisService) {}

  private buildKeys(key: string) {
    const prefix = `ai:stream:${key}`
    return {
      lockKey: `${prefix}:lock`,
      // Each leader run owns a stream key of its own (`:stream:<runId>`) so a
      // new run never writes into — nor deletes — a stream that earlier
      // followers are still draining. Readers resolve the run from lockKey.
      streamPrefix: `${prefix}:stream`,
      resultKey: `${prefix}:result`,
      errorKey: `${prefix}:error`,
    }
  }

  private parseLockRunId(lockValue: string | null): string | null {
    if (!lockValue) return null
    const separatorIndex = lockValue.indexOf(':')
    if (separatorIndex === -1) return null
    return lockValue.slice(separatorIndex + 1) || null
  }

  async runWithStream<T>(options: AiInFlightOptions<T>): Promise<{
    role: 'leader' | 'follower'
    events: AsyncIterable<AiStreamEvent>
    result: Promise<T>
  }> {
    const redis = this.redisService.getClient()
    const { lockKey, streamPrefix, resultKey, errorKey } = this.buildKeys(
      options.key,
    )

    // bypassResultCache never reads the cached resultKey, but the delete is
    // deferred until this instance actually holds lockKey (see below) — deleting
    // it here would open a window where a concurrent plain request (e.g. an
    // unrelated follower polling the same key) sees resultKey, errorKey, and
    // lockKey all empty and throws.
    const existingResultId = options.bypassResultCache
      ? null
      : await redis.get(resultKey)
    if (existingResultId) {
      if (isDev) {
        this.logger.debug(`inflight result hit key=${options.key}`)
      }
      try {
        const result = await options.parseResult(existingResultId)
        return {
          role: 'follower',
          events: this.createImmediateDoneStream(existingResultId),
          result: Promise.resolve(result),
        }
      } catch {
        this.logger.debug(
          `inflight stale result, clearing cache key=${options.key}`,
        )
        await redis.del(resultKey)
        await redis.del(errorKey)
      }
    }

    const runId = `${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`
    const lockMode = options.bypassResultCache ? 'force' : 'plain'
    const lockValue = `${lockMode}:${runId}`

    let acquired =
      (await redis.set(lockKey, lockValue, 'EX', options.lockTtlSec, 'NX')) ===
      'OK'

    // A force request that loses the race waits out a plain leader instead
    // of spawning a second writer, but joins another force immediately —
    // two force runs converging on one leader is the desired outcome.
    if (!acquired && options.bypassResultCache) {
      acquired = await this.waitForForceLock(
        redis,
        lockKey,
        lockValue,
        options.lockTtlSec,
      )
    }

    if (acquired) {
      const streamKey = `${streamPrefix}:${runId}`
      if (options.bypassResultCache) {
        // Safe now: lockKey exists, so a concurrent follower checking
        // resultKey/errorKey/lockKey will see the lock and keep waiting
        // instead of finding all three empty.
        await redis.del(resultKey)
        await redis.del(errorKey)
      }
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
      }).finally(async () => {
        clearInterval(heartbeat)
        await redis.del(lockKey)
      })

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
    // No holder means the leader released between our failed lock attempt and
    // this read; `runId` was never used as a leader, so its stream is empty and
    // the reader falls through to the resultKey/errorKey/lockKey checks.
    const holderRunId = this.parseLockRunId(await redis.get(lockKey)) ?? runId
    return {
      role: 'follower',
      events: this.createStreamReader(options, {
        streamKey: `${streamPrefix}:${holderRunId}`,
        resultKey,
        errorKey,
        lockKey,
      }),
      result: this.waitForResult(options, { resultKey, errorKey, lockKey }),
    }
  }

  private async waitForForceLock(
    redis: ReturnType<RedisService['getClient']>,
    lockKey: string,
    lockValue: string,
    lockTtlSec: number,
  ): Promise<boolean> {
    const holder = await redis.get(lockKey)
    if (holder?.startsWith('force:')) {
      return false
    }

    const deadline = Date.now() + lockTtlSec * 1000
    while (Date.now() < deadline) {
      await delay(200)
      if (
        (await redis.set(lockKey, lockValue, 'EX', lockTtlSec, 'NX')) === 'OK'
      ) {
        return true
      }

      // The holder can change while we wait — if another force took over
      // (e.g. it raced in via the plain leader's release), join it now
      // instead of blocking out the rest of the timeout.
      const currentHolder = await redis.get(lockKey)
      if (currentHolder?.startsWith('force:')) {
        return false
      }
    }

    return false
  }

  private async executeLeader<T>(
    options: AiInFlightOptions<T>,
    keys: { streamKey: string; resultKey: string; errorKey: string },
  ): Promise<T> {
    const redis = this.redisService.getClient()
    let streamTtlSet = false
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
          // Run-scoped stream keys are never reused, so a leader that dies
          // mid-run would orphan this key without an early TTL.
          if (!streamTtlSet) {
            streamTtlSet = true
            await redis.expire(keys.streamKey, options.resultTtlSec)
          }
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
      // Use short TTL for error cache so retries are not blocked by stale errors.
      const errorTtl = Math.min(options.lockTtlSec, 30)
      await redis.set(keys.errorKey, message, 'EX', errorTtl)
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
      await redis.expire(keys.streamKey, errorTtl)
      throw error
    }
  }

  // PRESERVE: cached hydrate bypasses snake_case conversion. Controllers using
  // @HTTPDecorators.RawResponse emit the cached blob via sendSseEvent without
  // ResponseInterceptor case-transform — this matches pre-pi-migration wire
  // bytes for cache-hit responses. Do not route this through transformResponseCase.
  // MUST NOT call incrementCost — cache-hit path
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
          throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
            message: 'AI stream ended without result',
          })
        }

        if (Date.now() - startAt > options.idleTimeoutMs) {
          throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
            message: 'AI stream idle timeout',
          })
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
        throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
          message: errorMessage,
        })
      }

      const lockExists = await redis.exists(keys.lockKey)
      if (!lockExists) {
        throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
          message: 'AI processing ended without result',
        })
      }

      if (Date.now() - startAt > options.idleTimeoutMs) {
        throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
          message: 'AI processing idle timeout',
        })
      }

      await delay(100)
    }
  }
}
