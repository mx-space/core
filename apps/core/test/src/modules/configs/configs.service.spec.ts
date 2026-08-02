import { AppErrorCode } from '~/common/errors'
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

  it('reads imageGenerationOptions defaults via get()', async () => {
    const redisClient = {
      get: vi.fn().mockResolvedValue(JSON.stringify(generateDefaultConfig())),
      set: vi.fn().mockResolvedValue('OK'),
    }
    const redisService = {
      getClient: vi.fn(() => redisClient),
      waitForReady: vi.fn().mockResolvedValue(undefined),
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

    await expect(service.get('imageGenerationOptions')).resolves.toEqual({
      enable: false,
      provider: 'openrouter',
      apiKey: '',
      endpoint: '',
      model: '',
      defaultAspectRatio: '16:9',
      defaultQuality: 'standard',
      defaultFormat: 'png',
    })
  })

  it('migrates legacy Dodo credential names into provider-neutral fields', async () => {
    const redisClient = {
      set: vi.fn().mockResolvedValue('OK'),
    }
    const redisService = {
      getClient: vi.fn(() => redisClient),
      waitForReady: vi.fn().mockResolvedValue(undefined),
    }
    const optionsRepository = {
      findAll: vi.fn().mockResolvedValue([
        {
          name: 'membership',
          value: {
            enabled: true,
            provider: 'dodo',
            dodoApiKey: 'legacy-api-key',
            dodoWebhookKey: 'legacy-webhook-key',
            dodoEnvironment: 'test_mode',
          },
        },
      ]),
    }

    const service = new ConfigsService(
      optionsRepository as any,
      redisService as any,
      {} as any,
      { emit: vi.fn() } as any,
    )

    await service.onModuleInit()

    const cachedConfig = JSON.parse(redisClient.set.mock.calls[0][1])
    expect(cachedConfig.membership).toMatchObject({
      apiKey: 'legacy-api-key',
      environment: 'test_mode',
      webhookSigningKey: 'legacy-webhook-key',
    })
    expect(cachedConfig.membership).not.toHaveProperty('dodoApiKey')
    expect(cachedConfig.membership).not.toHaveProperty('dodoWebhookKey')
    expect(cachedConfig.membership).not.toHaveProperty('dodoEnvironment')
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

  describe('imageGenerationOptions provider validation', () => {
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

      return { service }
    }

    it('rejects provider: "custom" with a blank endpoint', async () => {
      const { service } = createService(generateDefaultConfig())

      await expect(
        service.patchAndValid('imageGenerationOptions', {
          provider: 'custom',
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.CONFIG_VALIDATION_FAILED })
    })

    it('accepts provider: "custom" when an endpoint is already configured', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.imageGenerationOptions.endpoint =
        'https://existing.example.com/v1'
      const { service } = createService(currentConfig)

      const result = await service.patchAndValid('imageGenerationOptions', {
        provider: 'custom',
      })

      expect(result.provider).toBe('custom')
    })

    it('accepts provider: "custom" together with a newly-supplied endpoint in the same patch', async () => {
      const { service } = createService(generateDefaultConfig())

      const result = await service.patchAndValid('imageGenerationOptions', {
        provider: 'custom',
        endpoint: 'https://new-custom.example.com/v1',
      })

      expect(result.provider).toBe('custom')
      expect(result.endpoint).toBe('https://new-custom.example.com/v1')
    })

    it('leaves the default "openrouter" provider unaffected by the custom-endpoint check', async () => {
      const { service } = createService(generateDefaultConfig())

      const result = await service.patchAndValid('imageGenerationOptions', {
        provider: 'openrouter',
      })

      expect(result.provider).toBe('openrouter')
    })
  })

  describe('S3 and image-generation option save round-trips', () => {
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

      return { service }
    }

    it('accepts the section re-submitted verbatim as fetched, with apiKey/endpoint/model still "" — the exact shape the admin form sends when it never touches a hidden field', async () => {
      const { service } = createService(generateDefaultConfig())
      const fetched = await service.get('imageGenerationOptions')

      const result = await service.patchAndValid('imageGenerationOptions', {
        ...fetched,
        enable: true,
      })

      expect(result).toMatchObject({
        enable: true,
        apiKey: '',
        endpoint: '',
        model: '',
      })
    })

    it('accepts an explicit null for apiKey/endpoint/model and normalizes each to "" rather than throwing', async () => {
      const { service } = createService(generateDefaultConfig())

      const result = await service.patchAndValid('imageGenerationOptions', {
        apiKey: null,
        endpoint: null,
        model: null,
      } as any)

      expect(result).toMatchObject({ apiKey: '', endpoint: '', model: '' })
    })

    it('still rejects provider: "custom" when endpoint arrives as null (normalizes to "" first, then the custom-endpoint check still fires)', async () => {
      const { service } = createService(generateDefaultConfig())

      await expect(
        service.patchAndValid('imageGenerationOptions', {
          provider: 'custom',
          endpoint: null,
        } as any),
      ).rejects.toMatchObject({ code: AppErrorCode.CONFIG_VALIDATION_FAILED })
    })

    it('accepts legacy null S3 values in backupOptions', async () => {
      const { service } = createService(generateDefaultConfig())

      const result = await service.patchAndValid('backupOptions', {
        enable: false,
        endpoint: null,
        region: null,
        bucket: null,
        secretId: '',
        secretKey: '',
      } as any)

      expect(result).toMatchObject({
        enable: false,
        endpoint: '',
        region: 'auto',
        bucket: '',
      })
    })
  })
})
