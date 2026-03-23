import type { OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose'
import { cloneDeep, merge, mergeWith } from 'es-toolkit/compat'
import type { z, ZodError } from 'zod'

import { BizException } from '~/common/exceptions/biz.exception'
import { EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import type { AIProviderConfig } from '~/modules/ai/ai.types'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  ConfigVersionScopes,
  ConfigVersionService,
} from '~/processors/redis/config-version.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
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
import { OptionModel } from './configs.model'
import type { OAuthConfig } from './configs.schema'

const configsKeySet = new Set(Object.keys(configDtoMapping))

/*
 * NOTE:
 * 1. 读配置在 Redis 中，getConfig 为收口，获取配置都从 Redis 拿，初始化之后入到 Redis，
 * 2. 对于加密的字段，在 Redis 的缓存中应该也是加密的。
 * 3. 何时解密，在 Node 中消费时，即 getConfig 时统一解密。
 */
@Injectable()
export class ConfigsService implements OnModuleInit {
  private readonly logger = new Logger(ConfigsService.name)
  private configInitd = false
  private configInitPromise?: Promise<void>

  constructor(
    @InjectModel(OptionModel)
    private readonly optionModel: ReturnModelType<typeof OptionModel>,

    private readonly redisService: RedisService,
    private readonly configVersionService: ConfigVersionService,

    private readonly eventManager: EventManagerService,
  ) {}

  async onModuleInit() {
    await this.ensureConfigInitialized()
    this.logger.log('Config 已经加载完毕！')
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

  public get defaultConfig() {
    return generateDefaultConfig()
  }

  protected async configInit(force = false) {
    if (!force && this.configInitd) {
      return
    }

    const configs = await this.optionModel.find().lean()
    const mergedConfig = generateDefaultConfig()
    configs.forEach((field) => {
      const name = field.name as keyof IConfig

      if (!configsKeySet.has(name)) {
        return
      }
      // skip url patch in dev mode
      if (isDev && name === 'url') {
        return
      }
      const value = field.value
      mergedConfig[name] = { ...mergedConfig[name], ...value }
    })

    await this.setConfig(mergedConfig)
  }

  public async get<T extends keyof IConfig>(
    key: T,
  ): Promise<Readonly<IConfig[T]>> {
    const config = await this.waitForConfigReady()
    return config[key]
  }

  // Config 在此收口
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
        this.logger.error('获取配置失败')
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
    const updatedConfigRow = await this.optionModel
      .findOneAndUpdate(
        { name: key as string },
        {
          value: mergeWith(cloneDeep(config[key]), data, (old, newer) => {
            // 数组不合并
            if (Array.isArray(old)) {
              return newer
            }
            // 对象合并
            if (typeof old === 'object' && typeof newer === 'object') {
              return { ...old, ...newer }
            }
          }),
        },
        { upsert: true, new: true },
      )
      .lean()
    const newData = updatedConfigRow.value
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
      throw new BizException(ErrorCodeEnum.ConfigNotFound)
    }
    // 如果是评论设置，并且尝试启用 AI 审核，就检查 AI 配置
    if (key === 'commentOptions' && (value as any).aiReview === true) {
      const aiConfig = await this.get('ai')
      const hasEnabledProvider = aiConfig.providers?.some((p) => p.enabled)
      if (!hasEnabledProvider) {
        throw new BizException(ErrorCodeEnum.AIProviderNotEnabled)
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
        return this.patch(key, instanceValue as any)
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
      // Resend 验证: from 和 apiKey 必填
      if (!mailOptions.from) {
        errors.push('mailOptions.from: 发件邮箱地址不能为空')
      }
      if (!mailOptions.resend?.apiKey) {
        errors.push('mailOptions.resend.apiKey: Resend API Key 不能为空')
      }
    } else if (
      mailOptions.provider === 'smtp' && // SMTP 验证: 至少需要 user 或 from
      !mailOptions.smtp?.user &&
      !mailOptions.from
    ) {
      errors.push(
        'mailOptions.smtp.user 或 mailOptions.from: 至少需要填写一个发件人',
      )
    }

    if (errors.length > 0) {
      throw new BizException(
        ErrorCodeEnum.ConfigValidationFailed,
        errors.join('; '),
      )
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
      throw new BizException(
        ErrorCodeEnum.ConfigValidationFailed,
        errorMessages.join('; '),
      )
    }
    return result.data
  }

  public async getAiProviderById(
    providerId?: string,
  ): Promise<AIProviderConfig | null> {
    if (!providerId) {
      return null
    }

    const row = await this.optionModel.findOne({ name: 'ai' }).lean()
    const providers = row?.value?.providers as AIProviderConfig[] | undefined
    const storedProvider = providers?.find((p) => p.id === providerId)

    if (storedProvider) {
      return storedProvider
    }

    const cached = await this.get('ai')
    const cachedProvider = cached.providers?.find((p) => p.id === providerId)

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
