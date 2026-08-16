import { describe, expect, it, vi } from 'vitest'

import { RedisKeys } from '~/constants/cache.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { getRedisKey } from '~/utils/redis.util'

const REVIEW_PASSWORD = 'persistent-review-password'

describe('review demo OAuth secret persistence', () => {
  it('keeps the password encrypted through enable, disable, and re-enable saves', async () => {
    let cachedConfig: string | null = null
    const storedOptions = new Map<string, unknown>()
    const redisClient = {
      get: vi.fn(async () => cachedConfig),
      set: vi.fn(async (_key: string, value: string) => {
        cachedConfig = value
        return 'OK'
      }),
    }
    const optionsRepository = {
      findAll: vi.fn(async () => []),
      upsert: vi.fn(async (name: string, value: unknown) => {
        storedOptions.set(name, structuredClone(value))
        return { id: 'oauth-option', name, value }
      }),
    }
    const service = new ConfigsService(
      optionsRepository as any,
      {
        getClient: vi.fn(() => redisClient),
        waitForReady: vi.fn().mockResolvedValue(undefined),
      } as any,
      { bump: vi.fn() } as any,
      { emit: vi.fn() } as any,
    )
    await service.onModuleInit()

    await service.patchAndValid('oauth', {
      public: { apple: { reviewDemoEnabled: 'true' } },
      secrets: { apple: {} },
    })
    await service.patchAndValid('oauth', {
      secrets: { apple: { reviewDemoPassword: REVIEW_PASSWORD } },
    })

    for (const reviewDemoEnabled of ['', 'true']) {
      await service.patchAndValid('oauth', {
        public: { apple: { reviewDemoEnabled } },
        secrets: { apple: {} },
      })
      const rawOauth = storedOptions.get('oauth') as {
        secrets: { apple: { reviewDemoPassword: string } }
      }
      expect(rawOauth.secrets.apple.reviewDemoPassword).not.toBe(
        REVIEW_PASSWORD,
      )
      expect(
        rawOauth.secrets.apple.reviewDemoPassword.startsWith('$${mx}$$'),
      ).toBe(true)
      await expect(service.get('oauth')).resolves.toMatchObject({
        public: { apple: { reviewDemoEnabled } },
        secrets: { apple: { reviewDemoPassword: REVIEW_PASSWORD } },
      })
      const cachedOauth = JSON.parse(cachedConfig!).oauth
      expect(cachedOauth.secrets.apple.reviewDemoPassword).toBe(
        rawOauth.secrets.apple.reviewDemoPassword,
      )
    }

    expect(redisClient.set).toHaveBeenCalledWith(
      getRedisKey(RedisKeys.ConfigCache),
      expect.any(String),
    )
  })
})
