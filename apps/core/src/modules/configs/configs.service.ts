import type { OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { cloneDeep, merge, mergeWith } from 'es-toolkit/compat'
import type { z, ZodError } from 'zod'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import {
  type AIModelAssignment,
  type AIProviderCapability,
  type AIProviderConfig,
} from '~/modules/ai/ai.types'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  ConfigVersionScopes,
  ConfigVersionService,
} from '~/processors/redis/config-version.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { camelcaseKeys } from '~/utils/tool.util'

import { backupEncryptionPublicKey } from '../backup/backup-crypto'
import { generateDefaultConfig } from './configs.default'
import {
  decryptObject,
  encryptObject,
  removeEmptyEncryptedFields,
  sanitizeConfigForResponse,
} from './configs.encrypt.util'
import { configDtoMapping, IConfig } from './configs.interface'
import type { OAuthConfig } from './configs.schema'
import {
  canonicalConfigRows,
  LegacyConfigConflictError,
  legacySecretConflicts,
  normalizeLegacyConfig,
  normalizeLegacyPatch,
  updateLegacyMedia,
} from './legacy-config.util'
import { OptionsRepository } from './options.repository'

const aggregateConfigKeys = new Set<keyof IConfig>([
  'ai',
  'commentOptions',
  'seo',
  'url',
])

const s3StorageNullDefaults = {
  endpoint: '',
  bucket: '',
  region: 'auto',
} as const

function normalizeS3StorageOptionNulls<T extends object>(value: T): T {
  const normalized = { ...value } as Record<string, unknown>

  for (const [key, defaultValue] of Object.entries(s3StorageNullDefaults)) {
    if (normalized[key] === null) {
      normalized[key] = defaultValue
    }
  }

  return normalized as T
}

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
  private stageCache = false
  private stagedConfig?: IConfig
  private sourceConfig: Record<string, any> = {}
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
    const encrypted = encryptObject(cloneDeep(config))
    if (this.stageCache) {
      this.stagedConfig = encrypted
      return
    }
    const redis = await this.getRedisClient()
    await redis.set(
      getRedisKey(RedisKeys.ConfigCache),
      JSON.stringify(encrypted),
    )
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

    const rows = await this.optionsRepository.findAll()
    const raw = Object.fromEntries(rows.map((row) => [row.name, row.value]))
    const plaintext = decryptObject(cloneDeep(raw))
    this.sourceConfig = cloneDeep(plaintext)
    if (isDev) delete plaintext.url
    await this.setConfig(
      normalizeLegacyConfig(plaintext, { allowConflicts: true }),
    )
  }

  public async get<T extends keyof IConfig>(
    key: T,
  ): Promise<Readonly<IConfig[T]>> {
    const config = await this.getStoredConfig()
    return decryptObject(config[key], key)
  }

  // Single entry point for config reads
  private async getStoredConfig(errorRetryCount = 3): Promise<IConfig> {
    await this.ensureConfigInitialized()
    if (this.stageCache && this.stagedConfig)
      return cloneDeep(this.stagedConfig)

    const redis = await this.getRedisClient()
    const configCache = await redis.get(getRedisKey(RedisKeys.ConfigCache))

    if (configCache) {
      try {
        const configValue = JSON.parse(configCache) as IConfig
        return configValue
      } catch (error) {
        await this.ensureConfigInitialized(true)
        if (errorRetryCount > 0) {
          return await this.getStoredConfig(errorRetryCount - 1)
        }
        this.logger.error('Failed to load config')
        throw error
      }
    } else {
      await this.ensureConfigInitialized(true)

      return await this.getStoredConfig()
    }
  }

  public async getConfig(): Promise<Readonly<IConfig>> {
    return decryptObject(await this.getStoredConfig())
  }

  /**
   * Get config with encrypted fields removed (for API response)
   */
  public async getConfigForResponse(): Promise<Readonly<IConfig>> {
    return sanitizeConfigForResponse(await this.getStoredConfig())
  }

  /**
   * Get a specific config section with encrypted fields removed (for API response)
   */
  public async getForResponse<T extends keyof IConfig>(
    key: T,
  ): Promise<Readonly<IConfig[T]>> {
    const config = await this.getStoredConfig()
    const value = config[key]
    return sanitizeConfigForResponse(value as object, key) as IConfig[T]
  }

  private async patch<T extends keyof IConfig>(
    key: T,
    data: Partial<IConfig[T]>,
  ): Promise<IConfig[T]> {
    const config = await this.getConfig()
    const conflicts = legacySecretConflicts(key, this.sourceConfig[key] ?? {})
    for (const path of conflicts) {
      const replacement = path
        .split('.')
        .reduce<any>((node, part) => node?.[part], data)
      if (typeof replacement !== 'string' || !replacement)
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `CONFIG_SECRET_CONFLICT (${key}.${path}); explicitly replace the canonical credential to resolve it`,
        })
    }
    if (key === 'imageGenerationOptions' || key === 'ttsOptions') {
      const canonical = updateLegacyMedia(config as IConfig, key, data)
      const storedAi = await this.optionsRepository.upsert(
        'ai',
        encryptObject(cloneDeep(canonical.ai), 'ai'),
      )
      await this.optionsRepository.deleteByName?.('imageGenerationOptions')
      await this.optionsRepository.deleteByName?.('ttsOptions')
      await this.setConfig(canonical)
      await this.eventManager.emit(
        EventBusEvents.ConfigChanged,
        storedAi.value,
        {
          scope: EventScope.TO_SYSTEM,
        },
      )
      return encryptObject(cloneDeep(canonical[key]), key) as IConfig[T]
    }
    const updatedConfigRow = await this.optionsRepository.upsert(
      key as string,
      encryptObject(
        mergeWith(cloneDeep(config[key]), data, (old, newer, field) => {
          if (newer === null) {
            return null
          }
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
        key,
      ),
    )
    const newData = updatedConfigRow.value as IConfig[T]
    this.sourceConfig[key] = decryptObject(cloneDeep(newData), key)
    const mergedFullConfig = normalizeLegacyConfig(
      Object.assign(
        {},
        key === 'ai' ? canonicalConfigRows(config as IConfig) : config,
        { [key]: decryptObject(cloneDeep(newData), key) },
      ),
    )

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
    if (this.optionsRepository.withConfigLock) {
      const effects: Array<() => Promise<unknown>> = []
      const publication = await this.optionsRepository.withConfigLock(
        async (repository) => {
          const versions = {
            bump: (...args: Parameters<ConfigVersionService['bump']>) => {
              effects.push(() => this.configVersionService.bump(...args))
              return Promise.resolve(0)
            },
          } as ConfigVersionService
          const events = {
            emit: (...args: Parameters<EventManagerService['emit']>) => {
              effects.push(() => this.eventManager.emit(...args))
              return Promise.resolve()
            },
          } as EventManagerService
          const scoped = new ConfigsService(
            repository,
            this.redisService,
            versions,
            events,
          )
          scoped.stageCache = true
          await scoped.ensureConfigInitialized()
          const result = await scoped.patchAndValidUnlocked(key, value)
          return { result, config: scoped.stagedConfig! }
        },
        async ({ config }) => {
          await this.setConfig(config)
          for (const effect of effects) await effect()
        },
      )
      return publication.result
    }
    return this.patchAndValidUnlocked(key, value)
  }

  private async patchAndValidUnlocked<T extends keyof IConfig>(
    key: T,
    value: Partial<IConfig[T]>,
  ) {
    try {
      value = normalizeLegacyPatch(key, camelcaseKeys(value)) as any
    } catch (error) {
      if (error instanceof LegacyConfigConflictError)
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: error.message,
        })
      throw error
    }
    value = removeEmptyEncryptedFields(value as object, key) as Partial<
      IConfig[T]
    >

    if (key === 'backupOptions' || key === 'imageStorageOptions') {
      value = normalizeS3StorageOptionNulls(value)
    }

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
      const hasEnabledProvider = aiConfig.providers?.some(
        (p) => p.enabled && (p.capabilities?.text ?? true),
      )
      if (!hasEnabledProvider) {
        throw createAppException(AppErrorCode.AI_PROVIDER_DISABLED)
      }
    }
    const instanceValue = this.validWithDto(dto, value) as Partial<IConfig[T]>

    if (key === 'backupOptions') {
      const next = await this.buildNextConfigForValidation(key, instanceValue)
      if (
        next.backupOptions.encryptionPublicKey ||
        next.backupOptions.encryptionEnabled
      ) {
        try {
          backupEncryptionPublicKey(next.backupOptions.encryptionPublicKey)
        } catch (error) {
          throw createAppException(AppErrorCode.INVALID_PARAMETER, {
            message: error.message,
          })
        }
      }
    }

    if (key === 'ai') {
      const nextConfig = await this.buildNextConfigForValidation(
        key,
        instanceValue,
      )
      this.validateAiFeatureRoutes(nextConfig.ai)
    }

    if (key === 'mailOptions') {
      const nextConfig = await this.buildNextConfigForValidation(
        key,
        instanceValue,
      )
      this.validateMailProvider(nextConfig)
    }

    if (key === 'imageGenerationOptions') {
      const nextConfig = await this.buildNextConfigForValidation(
        key,
        instanceValue,
      )
      this.validateImageGenerationProvider(nextConfig)
    }

    if (key === 'ttsOptions') {
      const nextConfig = await this.buildNextConfigForValidation(
        key,
        instanceValue,
      )
      this.validateTtsProvider(nextConfig)
    }

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

        const currentProviders = (current.providers || []).map((provider) => ({
          ...provider,
        }))
        const currentProvidersMap = currentProviders.reduce(
          (acc, item) => {
            acc[item.type] = item
            return acc
          },
          {} as Record<string, any>,
        )

        ;(value.providers || []).forEach((p) => {
          if (!currentProvidersMap[p.type]) {
            currentProviders.push(p)
          } else {
            Object.assign(currentProvidersMap[p.type], p)
          }
        })

        const nextOauth = {
          providers: currentProviders,
          public: merge(cloneDeep(current.public || {}), value.public || {}),
          secrets: merge(cloneDeep(current.secrets || {}), value.secrets || {}),
        }
        const option = await this.patch(key as 'oauth', nextOauth)

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
        if (newer === null) {
          return null
        }
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

  private validateImageGenerationProvider(config: IConfig) {
    const { imageGenerationOptions } = config

    if (
      imageGenerationOptions.provider === 'custom' &&
      !imageGenerationOptions.endpoint
    ) {
      throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
        message:
          'imageGenerationOptions.endpoint: required when provider is "custom"',
      })
    }
  }

  private validateTtsProvider(config: IConfig) {
    const { ttsOptions } = config

    if (ttsOptions.provider === 'custom' && !ttsOptions.endpoint) {
      throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
        message: 'ttsOptions.endpoint: required when provider is "custom"',
      })
    }
  }

  private validateAiFeatureRoutes(aiConfig: IConfig['ai']) {
    const providerIds = new Set<string>()
    for (const provider of aiConfig.providers ?? []) {
      if (providerIds.has(provider.id)) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.providers: duplicate provider id "${provider.id}"`,
        })
      }
      if (
        provider.type === 'typesafe' &&
        ((provider.capabilities?.text ?? true) ||
          provider.capabilities?.image ||
          provider.capabilities?.speech)
      ) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: 'TypeSafe supports decision capability only',
        })
      }
      providerIds.add(provider.id)
    }

    const textAssignments = [
      ['summaryModel', aiConfig.summaryModel],
      ['writerModel', aiConfig.writerModel],
      ['commentReviewModel', aiConfig.commentReviewModel],
      ['translationModel', aiConfig.translationModel],
      ['translationReviewModel', aiConfig.translationReviewModel],
      ['fieldTranslationModel', aiConfig.fieldTranslationModel],
      ['insightsModel', aiConfig.insightsModel],
      ['insightsTranslationModel', aiConfig.insightsTranslationModel],
    ] as const
    for (const [key, assignment] of textAssignments) {
      if (!assignment?.providerId) continue
      const provider = aiConfig.providers?.find(
        (candidate) => candidate.id === assignment.providerId,
      )
      if (!provider) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.${key}.providerId: provider "${assignment.providerId}" does not exist`,
        })
      }
      if (!(provider.capabilities?.text ?? true)) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.providers.${provider.id}.capabilities.text: required by ai.${key}`,
        })
      }
      if (!assignment.model?.trim() && !provider.defaultModel.trim()) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.${key}.model: a model or provider default model is required`,
        })
      }
    }

    const decision = aiConfig.decisionModel
    if (decision?.providerId) {
      const provider = aiConfig.providers?.find(
        (p) => p.id === decision.providerId,
      )
      if (
        !provider?.capabilities?.decision ||
        provider.type !== 'typesafe' ||
        !(decision.model?.trim() || provider.defaultModel?.trim())
      ) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message:
            'Decision model requires a TypeSafe provider with decision capability and a model',
        })
      }
    }

    const mediaAssignments = [
      ['imageGeneration', 'image', aiConfig.imageGeneration?.model],
      ['tts', 'speech', aiConfig.tts?.model],
    ] as const
    for (const [feature, capability, assignment] of mediaAssignments) {
      if (!assignment?.providerId) continue
      const provider = aiConfig.providers?.find(
        (candidate) => candidate.id === assignment.providerId,
      )
      if (!provider) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.${feature}.model.providerId: provider "${assignment.providerId}" does not exist`,
        })
      }
      if (!provider.capabilities?.[capability]) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.providers.${provider.id}.capabilities.${capability}: required by ai.${feature}`,
        })
      }
    }

    const validateRoute = (
      feature: 'imageGeneration' | 'tts',
      capability: 'image' | 'speech',
    ) => {
      const config = aiConfig[feature]
      if (!config?.enable) return

      const providerId = config.model?.providerId
      const provider = aiConfig.providers?.find(
        (candidate) => candidate.id === providerId,
      )
      if (!providerId || !provider || !provider.enabled) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.${feature}.model.providerId: an enabled provider is required`,
        })
      }
      if (!provider.capabilities?.[capability]) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.providers.${provider.id}.capabilities.${capability}: required by ai.${feature}`,
        })
      }
      if (!config.model?.model?.trim()) {
        throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
          message: `ai.${feature}.model.model: a model is required`,
        })
      }
    }

    validateRoute('imageGeneration', 'image')
    validateRoute('tts', 'speech')

    if (aiConfig.tts?.enable && !aiConfig.tts.voice) {
      throw createAppException(AppErrorCode.CONFIG_VALIDATION_FAILED, {
        message: 'ai.tts.voice: required when TTS is enabled',
      })
    }
  }

  private validWithDto(schema: z.ZodType, value: unknown): any {
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

  public async resolveAiProviderForCapability(
    capability: Exclude<AIProviderCapability, 'text'>,
    assignment?: AIModelAssignment | null,
  ): Promise<{ model?: string; provider: AIProviderConfig } | null> {
    if (!assignment?.providerId) return null

    const aiConfig = await this.get('ai')
    const provider = aiConfig.providers?.find(
      (candidate) =>
        candidate.id === assignment.providerId &&
        candidate.enabled &&
        candidate.capabilities?.[capability],
    )
    if (!provider) return null

    return { model: assignment.model?.trim() || undefined, provider }
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
