import { generateKeyPairSync } from 'node:crypto'

import { AppErrorCode } from '~/common/errors'
import { RedisKeys } from '~/constants/cache.constant'
import { AIProviderType } from '~/modules/ai/ai.types'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { decryptObject } from '~/modules/configs/configs.encrypt.util'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EncryptUtil } from '~/utils/encrypt.util'
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
  it('requires a public key to enable backup encryption and never accepts private keys in settings', async () => {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    let cache: string | null = null
    let stored: any
    const repository = {
      findAll: async () => [],
      upsert: vi.fn(async (name, value) => {
        stored = value
        return { name, value }
      }),
    }
    const service = new ConfigsService(
      repository as any,
      {
        waitForReady: async () => {},
        getClient: () => ({
          get: async () => cache,
          set: async (_key, value) => {
            cache = value
          },
        }),
      } as any,
      {} as any,
      { emit: vi.fn() } as any,
    )
    await expect(
      service.patchAndValid('backupOptions', { encryptionEnabled: true }),
    ).rejects.toThrow('public key')
    await expect(
      service.patchAndValid('backupOptions', {
        encryptionPublicKey: pair.privateKey,
      }),
    ).rejects.toThrow('public key')
    expect(repository.upsert).not.toHaveBeenCalled()
    await service.patchAndValid('backupOptions', {
      encryptionEnabled: true,
      encryptionPublicKey: pair.publicKey,
    })
    expect(stored.encryptionEnabled).toBe(true)
    expect(stored.encryptionPublicKey).toBe(pair.publicKey)
    expect(cache).not.toContain('PRIVATE KEY')
    await service.patchAndValid('backupOptions', {
      bucket: 'changed-without-replacing-key',
    })
    expect(
      (await service.getForResponse('backupOptions')).encryptionPublicKey,
    ).toBe(pair.publicKey)
  })
  it('keeps retained credentials encrypted in the database and every cached section', async () => {
    let cache: string | null = null
    let stored: any
    const redis = {
      get: vi.fn(async () => cache),
      set: vi.fn(async (_key, value) => {
        cache = value
      }),
    }
    const repository = {
      findAll: vi.fn(async () => [
        { name: 'mailOptions', value: { smtp: { pass: 'fake-smtp' } } },
        { name: 'backupOptions', value: { secretKey: 'fake-s3' } },
      ]),
      upsert: vi.fn(async (name, value) => {
        stored = value
        return { name, value }
      }),
    }
    const service = new ConfigsService(
      repository as any,
      { getClient: () => redis, waitForReady: async () => {} } as any,
      {} as any,
      { emit: vi.fn() } as any,
    )
    await service.patchAndValid('backupOptions', {
      enable: true,
      secretKey: '',
    })
    expect(stored.secretKey).not.toBe('fake-s3')
    expect(cache).not.toContain('fake-smtp')
    expect(cache).not.toContain('fake-s3')
    await expect(service.get('backupOptions')).resolves.toMatchObject({
      secretKey: 'fake-s3',
    })
    const spy = vi.spyOn(EncryptUtil, 'decrypt')
    spy.mockClear()
    expect((await service.getConfigForResponse()).mailOptions.smtp?.pass).toBe(
      '',
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

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
            version: 2,
            providers: [
              {
                ...config.ai.providers[0],
                apiKey: EncryptUtil.encrypt(
                  'sk-decrypted',
                  'ai.providers.0.apiKey',
                ),
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

  describe('AI provider and capability route validation', () => {
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
      const service = new ConfigsService(
        optionsRepository as any,
        redisService as any,
        {} as any,
        { emit: vi.fn() } as any,
      )
      return { service }
    }

    it('saves a LobeHub provider and model assignment without an API key', async () => {
      const { service } = createService(generateDefaultConfig())

      const result = await service.patchAndValid('ai', {
        providers: [
          {
            id: 'lobehub',
            name: 'LobeHub Cloud',
            type: AIProviderType.LobeHub,
            apiKey: '',
            defaultModel: 'openai/gpt-5-mini',
            enabled: true,
          },
        ],
        writerModel: { providerId: 'lobehub', model: 'openai/gpt-5-mini' },
      })

      expect(result.providers).toMatchObject([
        { id: 'lobehub', type: AIProviderType.LobeHub, apiKey: '' },
      ])
      expect(result.writerModel).toEqual({
        providerId: 'lobehub',
        model: 'openai/gpt-5-mini',
      })
    })

    it('rejects a new API-key provider without a key', async () => {
      const { service } = createService(generateDefaultConfig())

      await expect(
        service.patchAndValid('ai', {
          providers: [
            {
              id: 'openai',
              name: 'OpenAI',
              type: AIProviderType.OpenAICompatible,
              apiKey: '',
              defaultModel: 'gpt-5-mini',
              enabled: true,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.CONFIG_VALIDATION_FAILED })
    })

    it('retains an existing provider key when re-saving a masked key', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.ai.providers = [
        {
          id: 'openai',
          name: 'OpenAI',
          type: AIProviderType.OpenAICompatible,
          apiKey: 'existing-key',
          defaultModel: 'gpt-5-mini',
          enabled: true,
        },
      ]
      const { service } = createService(currentConfig)

      const result = await service.patchAndValid('ai', {
        providers: [{ ...currentConfig.ai.providers[0], apiKey: '' }],
      })

      expect(decryptObject(result, 'ai').providers?.[0].apiKey).toBe(
        'existing-key',
      )
    })

    it('accepts image and speech routes that reuse one capable provider', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.ai.providers = [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          type: AIProviderType.OpenAICompatible,
          apiKey: 'secret',
          endpoint: 'https://openrouter.ai/api/v1',
          defaultModel: 'openai/gpt-5-mini',
          enabled: true,
          capabilities: { text: true, image: true, speech: true },
        },
      ]
      const { service } = createService(currentConfig)

      await expect(
        service.patchAndValid('ai', {
          ...currentConfig.ai,
          imageGeneration: {
            ...currentConfig.ai.imageGeneration,
            enable: true,
            model: { providerId: 'openrouter', model: 'google/gemini-image' },
          },
          tts: {
            ...currentConfig.ai.tts,
            enable: true,
            model: { providerId: 'openrouter', model: 'openai/gpt-4o-tts' },
            voice: 'alloy',
          },
        }),
      ).resolves.toBeDefined()
    })

    it('rejects an enabled media feature when its provider lacks the capability', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.ai.providers = [
        {
          id: 'text-only',
          name: 'Text only',
          type: AIProviderType.OpenAICompatible,
          apiKey: 'secret',
          defaultModel: 'gpt-5-mini',
          enabled: true,
          capabilities: { text: true, image: false, speech: false },
        },
      ]
      const { service } = createService(currentConfig)

      await expect(
        service.patchAndValid('ai', {
          ...currentConfig.ai,
          imageGeneration: {
            ...currentConfig.ai.imageGeneration,
            enable: true,
            model: { providerId: 'text-only', model: 'image-model' },
          },
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.CONFIG_VALIDATION_FAILED })
    })

    it('clears persisted media routes when an assignment is explicitly null', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.ai.imageGeneration.model = {
        providerId: 'shared-provider',
        model: 'image-model',
      }
      currentConfig.ai.tts.model = {
        providerId: 'shared-provider',
        model: 'speech-model',
      }
      const { service } = createService(currentConfig)

      const result = await service.patchAndValid('ai', {
        ...currentConfig.ai,
        imageGeneration: {
          ...currentConfig.ai.imageGeneration,
          model: null,
        },
        tts: {
          ...currentConfig.ai.tts,
          model: null,
        },
      })

      expect(result.imageGeneration?.model).toBeNull()
      expect(result.tts?.model).toBeNull()
    })

    it('does not treat an image-only provider as valid for comment review', async () => {
      const currentConfig = generateDefaultConfig()
      currentConfig.ai.providers = [
        {
          id: 'image-only',
          name: 'Image only',
          type: AIProviderType.OpenAICompatible,
          apiKey: 'secret',
          defaultModel: '',
          enabled: true,
          capabilities: {
            text: false,
            image: true,
            speech: false,
          },
        },
      ]
      const { service } = createService(currentConfig)

      await expect(
        service.patchAndValid('commentOptions', { aiReview: true }),
      ).rejects.toMatchObject({ code: AppErrorCode.AI_PROVIDER_DISABLED })
    })
  })

  describe('S3 option save round-trips', () => {
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
