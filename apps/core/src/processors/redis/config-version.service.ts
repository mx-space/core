import { Injectable, Logger } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import { RedisService } from './redis.service'

export const ConfigVersionScopes = {
  OAuth: 'oauth',
  Url: 'url',
  Mail: 'mail',
} as const

export type ConfigVersionScope =
  (typeof ConfigVersionScopes)[keyof typeof ConfigVersionScopes]

@Injectable()
export class ConfigVersionService {
  private readonly logger = new Logger(ConfigVersionService.name)

  constructor(private readonly redisService: RedisService) {}

  private getRedisVersionKey(scope: ConfigVersionScope) {
    return getRedisKey(RedisKeys.ConfigVersion, scope)
  }

  public async bump(scope: ConfigVersionScope) {
    const client = this.redisService.getClient()
    if (!this.redisService.isReady()) {
      this.logger.warn(this.formatLog('Skip config version bump', scope))
      return 0
    }

    try {
      return await client.incr(this.getRedisVersionKey(scope))
    } catch (error) {
      this.logger.error(
        this.formatLog('Config version bump failed', scope, error),
      )
      return 0
    }
  }

  public async getVersion(scope: ConfigVersionScope, fallback = 0) {
    if (!this.redisService.isReady()) {
      return fallback
    }

    try {
      const value = await this.redisService
        .getClient()
        .get(this.getRedisVersionKey(scope))

      return Number.parseInt(value || '', 10) || fallback
    } catch (error) {
      this.logger.error(
        this.formatLog('Config version read failed', scope, error),
      )
      return fallback
    }
  }

  public async getVersions<const T extends readonly ConfigVersionScope[]>(
    scopes: T,
    fallback: Partial<Record<ConfigVersionScope, number>> = {},
  ) {
    if (!this.redisService.isReady()) {
      return scopes.reduce(
        (acc, scope) => {
          acc[scope] = fallback[scope] ?? 0
          return acc
        },
        {} as Record<T[number], number>,
      )
    }

    try {
      const values = await this.redisService
        .getClient()
        .mget(scopes.map((scope) => this.getRedisVersionKey(scope)))

      return scopes.reduce(
        (acc, scope, index) => {
          acc[scope] =
            Number.parseInt(values[index] || '', 10) || fallback[scope] || 0
          return acc
        },
        {} as Record<T[number], number>,
      )
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          module: ConfigVersionService.name,
          message: 'Config versions read failed',
          scopes,
          redisStatus: this.redisService.getStatus(),
          error: error instanceof Error ? error.message : String(error),
        }),
      )

      return scopes.reduce(
        (acc, scope) => {
          acc[scope] = fallback[scope] ?? 0
          return acc
        },
        {} as Record<T[number], number>,
      )
    }
  }

  private formatLog(
    message: string,
    scope: ConfigVersionScope,
    error?: unknown,
  ) {
    return JSON.stringify({
      module: ConfigVersionService.name,
      message,
      scope,
      redisStatus: this.redisService.getStatus(),
      error: error instanceof Error ? error.message : undefined,
    })
  }
}
