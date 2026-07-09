import type { OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { cloneDeep, merge, mergeWith } from 'es-toolkit/compat'
import type { z, ZodError } from 'zod'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import type { AIProviderConfig } from '~/modules/ai/ai.types'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  ConfigVersionScopes,
  ConfigVersionService,
} from '~/processors/redis/config-version.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { camelcaseKeys } from '~/utils/tool.util'

import { generateDefaultConfig } from './configs.default'
import {
  decryptObject,
  encryptObject,
  removeEmptyEncryptedFields,
  sanitizeConfigForResponse,
} from './configs.encrypt.util'
import { configDtoMapping, IConfig } from './configs.interface'
import type { OAuthConfig } from './configs.schema'
import { OptionsRepository } from './options.repository'

const configsKeySet = new Set(Object.keys(configDtoMapping))
const aggregateConfigKeys = new Set<keyof IConfig>([
  'ai',
  'commentOptions',
  'seo',
  'url',
])

/*
 * NOTE:
 * 1. Configs live in Redis. `getConfig` is the single entry point; all reads
 *    come from Redis, and the initial values are loaded into Redis on startup.
 * 2. Encrypted fields stay encrypted in the Redis cache as well.
 * 3. Decryption happens at the point of consumption in Node — i.e. uniformly
 *    inside `getConfig`.
 */
@Injectable()
export class ConfigsService implements OnModuleInit {
  private readonly logger = new Logger(ConfigsService.name)
  private configInitd = false
  private configInitPromise?: Promise<void>

  constructor(
    private readonly optionsRepository: OptionsRepository,

    private readonly redisService: RedisService,
    private readonly configVersionService: ConfigVersionService,

    private readonly eventManager: EventManagerService,
  ) {}

  async onModuleInit() {
    await this.ensureConfigInitialized()
    this.logger.log('Config loaded successfully')
  }

  private async getRedisClient() {
    await this.redisService.waitForReady()

    return this.redisService.getClient()
  }

  private async setConfig(config: IConfig) {
    const redis = await this.getRedisClient()
    await redis.set(getRedisKey(RedisKeys.ConfigCache), JSON.stringify(config))
  }

  private async ensureConfigInitialized(force = false) {
    if (!force && this.configInitd) {
      return
    }

    if (!force && this.configInitPromise) {
      await this.configInitPromise
      return
    }

    const initPromise = this.configInit(force)
      .then(() => {
        this.configInitd = true
      })
      .catch((error) => {
        this.configInitd = false
        if (this.configInitPromise === initPromise) {
          this.configInitPromise = undefined
        }
        throw error
      })

    this.configInitPromise = initPromise
    await initPromise
  }

  public async waitForConfigReady() {
    await this.ensureConfigInitialized()
    return this.getConfig()
  }

  public async getOptionValue<T>(name: string, fallback: T): Promise<T> {
    const value = await this.optionsRepository.get<T>(name)
    return value ?? fallback
  }

  public async incrementOption(name: string, delta = 1) {
    return this.optionsRepository.increment(name, delta)
  }

  public get defaultConfig() {
    return generateDefaultConfig()
  }

  protected async configInit(force = false) {
    if (!force && this.configInitd) {
      return
    }

    const configs = await this.optionsRepository.findAll()
    const mergedConfig = generateDefaultConfig()
    const mergeStoredConfig = <T extends keyof IConfig>(
      name: T,
      value: unknown,
    ) => {
      const storedValue =
        value && typeof value === 'object' ? (value as Partial<IConfig[T]>) : {}
      mergedConfig[name] = {
        ...mergedConfig[name],
        ...storedValue,
      }
    }
    configs.forEach((field) => {
      const name = field.name as keyof IConfig

      if (!configsKeySet.has(name)) {
        return
      }
      // skip url patch in dev mode
      if (isDev && name === 'url') {
        return
      }

      // Backward-compat: migrate old flat thirdPartyServiceIntegration
      if (name === 'thirdPartyServiceIntegration') {
        const normalized = this.normalizeThirdPartyConfig(
          field.value as Record<string, any>,
        )
        mergeStoredConfig(name, normalized)
      } else {
        mergeStoredConfig(name, field.value)
      }
    })

    await this.setConfig(mergedConfig)
  }

  /**
   * Backward-compat: migrate old flat { githubToken } to new nested
   * { github: { enabled, token } } shape at read time.
   */
  private normalizeThirdPartyConfig(
    raw: Record<string, any>,
  ): IConfig['thirdPartyServiceIntegration'] {
    // Already new shape
    if (raw?.github && typeof raw.github === 'object') {
      return raw as IConfig['thirdPartyServiceIntegration']
    }
    // Old flat shape — convert
    return {
      github: { enabled: true, token: raw.githubToken || '' },
      tmdb: { enabled: false, apiKey: '' },
      bangumi: { enabled: true, accessToken: '' },
      neodb: { enabled: true },
      arxiv: { enabled: true },
      leetcode: { enabled: true },
      neteaseMusic: { enabled: true },
      qqMusic: { enabled: true },
    } as IConfig['thirdPartyServiceIntegration']
  }

  public async get<T extends keyof IConfig>(
    key: T,
  ): Promise<Readonly<IConfig[T]>> {
    const config = await this.waitForConfigReady()
    return config[key]
  }

  // Single entry point for config reads
  public async getConfig(errorRetryCount = 3): Promise<Readonly<IConfig>> {
    await this.ensureConfigInitialized()

    const redis = await this.getRedisClient()
    const configCache = await redis.get(getRedisKey(RedisKeys.ConfigCache))

    if (configCache) {
      try {
        const configValue = JSON.parse(configCache) as IConfig
        return decryptObject(configValue)
      } catch (error) {
        await this.ensureConfigInitialized(true)
        if (errorRetryCount > 0) {
          return await this.getConfig(errorRetryCount - 1)
        }
        this.logger.error('Failed to load config')
        throw error
      }
    } else {
      await this.ensureConfigInitialized(true)

      return await this.getConfig()
    }
  }

  /**
   * Get config with encrypted fields removed (for API response)
   */
  public async getConfigForResponse(): Promise<Readonly<IConfig>> {
    const config = await this.getConfig()
    return sanitizeConfigForResponse(config)
  }

  /**
   * Get a specific config section with encrypted fields removed (for API response)
   */
  public async getForResponse<T extends keyof IConfig>(
    key: T,
  ): Promise<Readonly<IConfig[T]>> {
    const config = await this.waitForConfigReady()
    const value = config[key]
    return sanitizeConfigForResponse(value as object, key) as IConfig[T]
  }

  private async patch<T extends keyof IConfig>(
    key: T,
    data: Partial<IConfig[T]>,
  ): Promise<IConfig[T]> {
    const config = await this.getConfig()
    const updatedConfigRow = await this.optionsRepository.upsert(
      key as string,
      mergeWith(cloneDeep(config[key]), data, (old, newer, field) => {
        // Arrays are not merged
        if (Array.isArray(old)) {
          return newer
        }
        // seo.i18n is replaced wholesale, otherwise a shallow object merge
        // could never drop a locale key that was removed in the patch
        if (field === 'i18n') {
          return newer
        }
        // Objects are merged
        if (typeof old === 'object' && typeof newer === 'object') {
          return { ...old, ...newer }
        }
      }),
    )
    const newData = updatedConfigRow.value as IConfig[T]
    const mergedFullConfig = Object.assign({}, config, { [key]: newData })

    await this.setConfig(mergedFullConfig)
    this.eventManager.emit(
      EventBusEvents.ConfigChanged,
      { ...newData },
      {
        scope: EventScope.TO_SYSTEM,
      },
    )

    return newData
  }

  private async notifyAggregateConfigUpdate<T extends keyof IConfig>(key: T) {
    if (!aggregateConfigKeys.has(key)) {
      return
    }

    await Promise.all([
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      }),
      this.eventManager.emit(
        BusinessEvents.AGGREGATE_UPDATE,
        {
          source: 'config',
          keys: [key],
        },
        {
          scope: EventScope.TO_SYSTEM,
        },
      ),
    ])
  }

  async patchAndValid<T extends keyof IConfig>(
    key: T,
    value: Partial<IConfig[T]>,
  ) {
    value = camelcaseKeys(value) as any
    value = removeEmptyEncryptedFields(value as object, key) as Partial<
      IConfig[T]
    >

    if (key === 'ai') {
      value = await this.hydrateAiProviderApiKeys(value as any)
    }

    const dto = configDtoMapping[key]
    if (!dto) {
      throw createAppException(AppErrorCode.CONFIG_NOT_FOUND, {
        id: key as string,
      })
    }
    // If this is the comment settings and AI review is being enabled, validate the AI config
    if (key === 'commentOptions' && (value as any).aiReview === true) {
      const aiConfig = await this.get('ai')
      const hasEnabledProvider = aiConfig.providers?.some((p) => p.enabled)
      if (!hasEnabledProvider) {
        throw createAppException(AppErrorCode.AI_PROVIDER_DISABLED)
      }
    }
    const instanceValue = this.validWithDto(dto, value) as Partial<IConfig[T]>

    if (key === 'mailOptions') {
      const nextConfig = await this.buildNextConfigForValidation(
        key,
        instanceValue,
      )
      this.validateMailProvider(nextConfig)
    }

    encryptObject(instanceValue, key)

    switch (key) {
      case 'url': {
        const newValue = await this.patch(key, instanceValue as any)
        await this.configVersionService.bump(ConfigVersionScopes.Url)
        await this.notifyAggregateConfigUpdate(key)
        return newValue
      }
      case 'mailOptions': {
        const option = await this.patch(
          key as 'mailOptions',
          instanceValue as any,
        )
        await this.configVersionService.bump(ConfigVersionScopes.Mail)
        await this.eventManager.emit(EventBusEvents.EmailInit, null, {
          scope: EventScope.TO_SYSTEM,
        })

        return option
      }
      case 'oauth': {
        const value = instanceValue as unknown as OAuthConfig
        const current = await this.get('oauth')

        const currentProvidersMap = (current.providers || []).reduce(
          (acc, item) => {
            acc[item.type] = item
            return acc
          },
          {} as Record<string, any>,
        )

        const currentProviders = current.providers || []
        ;(value.providers || []).forEach((p) => {
          if (!currentProvidersMap[p.type]) {
            currentProviders.push(p)
          } else {
            Object.assign(currentProvidersMap[p.type], p)
          }
        })

        let nextAuthSecrets = value.secrets
        if (value.secrets) {
          nextAuthSecrets = merge(current.secrets, nextAuthSecrets)
        }

        let nextAuthPublic = value.public
        if (value.public) {
          nextAuthPublic = merge(current.public, nextAuthPublic)
        }
        const option = await this.patch(key as 'oauth', {
          providers: currentProviders,
          secrets: nextAuthSecrets,
          public: nextAuthPublic,
        })

        await this.configVersionService.bump(ConfigVersionScopes.OAuth)
        return option
      }

      default: {
        const nextValue = await this.patch(key, instanceValue as any)
        await this.notifyAggregateConfigUpdate(key)
        return nextValue
      }
    }
  }

  private async buildNextConfigForValidation<T extends keyof IConfig>(
    key: T,
    data: Partial<IConfig[T]>,
  ): Promise<IConfig> {
    const current = await this.getConfig()
    const mergedSection = mergeWith(
      cloneDeep(current[key]),
      data,
      (old, newer) => {
        if (Array.isArray(old)) {
          return newer
        }
        if (typeof old === 'object' && typeof newer === 'object') {
          return { ...old, ...newer }
        }
      },
    )
    return Object.assign({}, current, { [key]: mergedSection })
  }

  private validateMailProvider(config: IConfig) {
    const { mailOptions } = config
    const errors: string[] = []

    if (mailOptions.provider === 'resend') {
      // Resend validation: `from` and `apiKey` are required
      if (!mailOptions.from) {
        errors.push('mailOptions.from: sender email address must not be empty')
      }
      if (!mailOptions.resend?.apiKey) {
        errors.push(
          'mailOptions.resend.apiKey: Resend API key must not be empty',
        )
      }
    } else if (
      mailOptions.provider === 'smtp' && // SMTP validation: at least one of `user` or `from` is required
      !mailOptions.smtp?.user &&
      !mailOptions.from
    ) {
      errors.push(
        'mailOptions.smtp.user or mailOptions.from: at least one sender must be provided',
      )
    }

    if (errors.length > 0) {
      throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
        message: errors.join('; '),
      })
    }
  }

  private validWithDto(schema: z.ZodTypeAny, value: unknown): any {
    const result = schema.safeParse(value)
    if (!result.success) {
      const zodError = result.error as ZodError
      const errorMessages = zodError.issues.map((err) => {
        const path = err.path.join('.')
        return path ? `${path}: ${err.message}` : err.message
      })
      throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
        message: errorMessages.join('; '),
      })
    }
    return result.data
  }

  public async getAiProviderById(
    providerId?: string,
  ): Promise<AIProviderConfig | null> {
    if (!providerId) {
      return null
    }

    const aiConfig = await this.get('ai')
    const cachedProvider = aiConfig.providers?.find((p) => p.id === providerId)

    return cachedProvider || null
  }

  private async hydrateAiProviderApiKeys(value: any) {
    if (!value || !Array.isArray(value.providers)) {
      return value
    }

    const current = await this.get('ai')
    if (!current?.providers?.length) {
      return value
    }

    const providerMap = new Map(current.providers.map((p) => [p.id, p]))
    const providers = value.providers.map((provider: any) => {
      if (provider?.apiKey) {
        return provider
      }
      const existing = providerMap.get(provider?.id)
      if (existing?.apiKey) {
        return { ...provider, apiKey: existing.apiKey }
      }
      return provider
    })

    return { ...value, providers }
  }
}
