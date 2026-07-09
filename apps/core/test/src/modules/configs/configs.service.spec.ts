import { RedisKeys } from '~/constants/cache.constant'
import { AIProviderType } from '~/modules/ai/ai.types'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { ConfigsService } from '~/modules/configs/configs.service'
import { getRedisKey } from '~/utils/redis.util'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

describe('ConfigsService', () => {
  it('waits for redis before writing config cache during initialization', async () => {
    const ready = createDeferred()
    const redisClient = {
      set: vi.fn().mockResolvedValue('OK'),
    }
    const redisService = {
      getClient: vi.fn(() => redisClient),
      waitForReady: vi.fn(() => ready.promise),
    }
    const optionsRepository = {
      findAll: vi.fn().mockResolvedValue([]),
    }

    const service = new ConfigsService(
      optionsRepository as any,
      redisService as any,
      {} as any,
      { emit: vi.fn() } as any,
    )
    const initPromise = service.onModuleInit()

    await flushPromises()

    expect(redisService.waitForReady).toHaveBeenCalledTimes(1)
    expect(redisClient.set).not.toHaveBeenCalled()

    ready.resolve()
    await expect(initPromise).resolves.toBeUndefined()

    expect(redisClient.set).toHaveBeenCalledWith(
      getRedisKey(RedisKeys.ConfigCache),
      JSON.stringify(generateDefaultConfig()),
    )
  })

  it('waits for redis before reading config cache', async () => {
    const initReady = Promise.resolve()
    const readReady = createDeferred()
    const redisClient = {
      get: vi.fn().mockResolvedValue(JSON.stringify(generateDefaultConfig())),
      set: vi.fn().mockResolvedValue('OK'),
    }
    const redisService = {
      getClient: vi.fn(() => redisClient),
      waitForReady: vi
        .fn()
        .mockImplementationOnce(() => initReady)
        .mockImplementation(() => readReady.promise),
    }
    const optionsRepository = {
      findAll: vi.fn().mockResolvedValue([]),
    }

    const service = new ConfigsService(
      optionsRepository as any,
      redisService as any,
      {} as any,
      { emit: vi.fn() } as any,
    )

    await flushPromises()
    redisClient.get.mockClear()

    const configPromise = service.getConfig()
    await flushPromises()

    expect(redisClient.get).not.toHaveBeenCalled()

    readReady.resolve()
    await expect(configPromise).resolves.toEqual(generateDefaultConfig())
    expect(redisClient.get).toHaveBeenCalledWith(
      getRedisKey(RedisKeys.ConfigCache),
    )
  })

  it('resolves AI providers from decrypted config cache', async () => {
    const config = generateDefaultConfig()
    config.ai.providers = [
      {
        id: 'custom-provider',
        name: 'Custom Provider',
        type: AIProviderType.OpenAICompatible,
        apiKey: 'sk-decrypted',
        endpoint: 'https://api.example.com/v1',
        defaultModel: 'gpt-5.5',
        enabled: true,
      },
    ]
    const redisClient = {
      get: vi.fn().mockResolvedValue(JSON.stringify(config)),
      set: vi.fn().mockResolvedValue('OK'),
    }
    const redisService = {
      getClient: vi.fn(() => redisClient),
      waitForReady: vi.fn().mockResolvedValue(undefined),
    }
    const optionsRepository = {
      findAll: vi.fn().mockResolvedValue([
        {
          name: 'ai',
          value: {
            providers: [
              {
                ...config.ai.providers[0],
                apiKey: '$${mx}$$encrypted',
              },
            ],
          },
        },
      ]),
      get: vi.fn(),
    }

    const service = new ConfigsService(
      optionsRepository as any,
      redisService as any,
      {} as any,
      { emit: vi.fn() } as any,
    )

    await expect(
      service.getAiProviderById('custom-provider'),
    ).resolves.toMatchObject({
      id: 'custom-provider',
      apiKey: 'sk-decrypted',
    })
    expect(optionsRepository.get).not.toHaveBeenCalled()
  })

  describe('seo.i18n patch semantics', () => {
    function createService(
      currentConfig: ReturnType<typeof generateDefaultConfig>,
    ) {
      const redisClient = {
        get: vi.fn().mockResolvedValue(JSON.stringify(currentConfig)),
        set: vi.fn().mockResolvedValue('OK'),
      }
      const redisService = {
        getClient: vi.fn(() => redisClient),
        waitForReady: vi.fn().mockResolvedValue(undefined),
      }
      const optionsRepository = {
        findAll: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(async (name: string, value: unknown) => ({
          id: '1' as any,
          name,
          value,
        })),
      }
      const eventManager = { emit: vi.fn() }

      const service = new ConfigsService(
        optionsRepository as any,
        redisService as any,
        {} as any,
        eventManager as any,
      )

      return { service, redisClient, optionsRepository, eventManager }
    }

    it('replaces stored seo.i18n wholesale, dropping locale keys absent from the patch', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.seo.i18n = {
        zh: { title: 'zh title', description: 'zh desc' },
        en: { title: 'en title' },
      }
      const { service } = createService(currentConfig)

      const result = await service.patchAndValid('seo', {
        i18n: { en: { title: 'new en title' } },
      })

      expect(result.i18n).toEqual({ en: { title: 'new en title' } })
    })

    it('leaves stored seo.i18n untouched when patching seo without i18n', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.seo.i18n = {
        zh: { title: 'zh title', description: 'zh desc' },
        en: { title: 'en title' },
      }
      const { service } = createService(currentConfig)

      const result = await service.patchAndValid('seo', {
        title: 'Updated title',
      })

      expect(result.title).toBe('Updated title')
      expect(result.i18n).toEqual(currentConfig.seo.i18n)
    })
  })
})
