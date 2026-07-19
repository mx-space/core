import { randomUUID } from 'node:crypto'

import { HttpStatus, Injectable, Logger } from '@nestjs/common'

import { AppException } from '~/common/errors/exception.types'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'

import { ConfigsService } from '../configs/configs.service'
import { RecentlyService } from '../recently/recently.service'
import {
  COMPANION_MOMENT_IDEMPOTENCY_TTL_SECONDS,
  COMPANION_MOMENT_LOCK_TTL_MS,
  COMPANION_MOMENT_SCHEMA_VERSION,
} from './companion.constants'
import type { CompanionDevicePrincipal } from './companion-device.guard'
import type { CompanionMomentRequestV1Dto } from './companion-presence.dto'

export interface CompanionMomentMutationResult {
  id: string
  createdAt: string
  url: string | null
}

@Injectable()
export class CompanionMomentService {
  private readonly logger = new Logger(CompanionMomentService.name)

  constructor(
    private readonly recentlyService: RecentlyService,
    private readonly redisService: RedisService,
    private readonly configsService: ConfigsService,
  ) {}

  async publish(
    principal: CompanionDevicePrincipal,
    request: CompanionMomentRequestV1Dto,
  ): Promise<CompanionMomentMutationResult> {
    const keySuffix = `${principal.ownerId}:${request.meta.requestId}`
    const resultKey = getRedisKey(`companion:moment:result:${keySuffix}`)
    const lockKey = getRedisKey(`companion:moment:lock:${keySuffix}`)
    const redis = this.redisService.getClient()

    if (!this.redisService.isReady()) {
      this.logger.warn(
        'Redis is unavailable; publishing moment without replay cache.',
      )
      return this.createRecently(request)
    }

    let existing: string | null
    try {
      existing = await redis.get(resultKey)
    } catch (error) {
      this.logger.warn(
        `Moment replay cache is unavailable; publishing without it: ${String(error)}`,
      )
      return this.createRecently(request)
    }
    if (existing) {
      try {
        return JSON.parse(existing) as CompanionMomentMutationResult
      } catch {
        await redis.del(resultKey).catch(() => undefined)
      }
    }

    const lockToken = randomUUID()
    let acquired: string | null
    try {
      acquired = await redis.set(
        lockKey,
        lockToken,
        'PX',
        COMPANION_MOMENT_LOCK_TTL_MS,
        'NX',
      )
    } catch (error) {
      this.logger.warn(
        `Moment replay lock is unavailable; publishing without it: ${String(error)}`,
      )
      return this.createRecently(request)
    }
    if (!acquired) {
      const completed = await redis.get(resultKey)
      if (completed)
        return JSON.parse(completed) as CompanionMomentMutationResult
      throw new AppException(
        'COMPANION_MOMENT_IN_PROGRESS',
        'This moment is already being published.',
        HttpStatus.SERVICE_UNAVAILABLE,
        { retryAfterMs: 500 },
      )
    }

    try {
      const result = await this.createRecently(request)
      try {
        await redis.set(
          resultKey,
          JSON.stringify(result),
          'EX',
          COMPANION_MOMENT_IDEMPOTENCY_TTL_SECONDS,
        )
      } catch (error) {
        this.logger.warn(
          `Moment was published but its replay cache could not be stored: ${String(error)}`,
        )
      }
      return result
    } finally {
      await redis
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken,
        )
        .catch(() => undefined)
    }
  }

  private async createRecently(
    request: CompanionMomentRequestV1Dto,
  ): Promise<CompanionMomentMutationResult> {
    const recently = await this.recentlyService.create({
      content: request.data.content,
      metadata: {
        kind: 'companion-moment',
        schemaVersion: COMPANION_MOMENT_SCHEMA_VERSION,
        observedAt: request.meta.observedAt,
        application: request.data.application,
        media: request.data.media,
      },
    })

    const webUrl = await this.configsService
      .get('url')
      .then((config) => config.webUrl?.replace(/\/$/, ''))
      .catch(() => undefined)

    return {
      id: String(recently.id),
      createdAt: recently.createdAt.toISOString(),
      url: webUrl ? `${webUrl}/thinking/${recently.id}` : null,
    }
  }
}
