import cluster from 'node:cluster'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { cloneDeep, merge, mergeWith } from 'lodash'
import type { ClassConstructor } from 'class-transformer'

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'

import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
import { EventScope } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { CacheService } from '~/processors/redis/cache.service'
import { RedisService } from '~/processors/redis/redis.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'
import { camelcaseKeys } from '~/utils/tool.util'

import { generateDefaultConfig } from './configs.default'
import { OAuthDto } from './configs.dto'
import { decryptObject, encryptObject } from './configs.encrypt.util'
import { configDtoMapping, IConfig } from './configs.interface'
import { OptionModel } from './configs.model'

const configsKeySet = new Set(Object.keys(configDtoMapping))

/*
 * NOTE:
 * 1. 读配置在 Redis 中，getConfig 为收口，获取配置都从 Redis 拿，初始化之后入到 Redis，
 * 2. 对于加密的字段，在 Redis 的缓存中应该也是加密的。
 * 3. 何时解密，在 Node 中消费时，即 getConfig 时统一解密。
 */
@Injectable()
export class ConfigsService {
  private logger: Logger
  constructor(
    @InjectModel(OptionModel)
    private readonly optionModel: ReturnModelType<typeof OptionModel>,

    private readonly redisService: RedisService,
    private readonly subpub: SubPubBridgeService,

    private readonly eventManager: EventManagerService,

    @Inject(VALIDATION_PIPE_INJECTION)
    private readonly validate: ExtendedValidationPipe,
  ) {
    this.configInit().then(() => {
      this.logger.log('Config 已经加载完毕！')
    })

    this.logger = new Logger(ConfigsService.name)
  }
  private configInitd = false

  private async setConfig(config: IConfig) {
    const redis = this.redisService.getClient()
    await redis.set(getRedisKey(RedisKeys.ConfigCache), JSON.stringify(config))
  }

  public async waitForConfigReady() {
    if (this.configInitd) {
      return await this.getConfig()
    }

    const maxCount = 10
    let curCount = 0
    do {
      if (this.configInitd) {
        return await this.getConfig()
      }
      await sleep(100)
      curCount += 1
    } while (curCount < maxCount)

    throw `重试 ${curCount} 次获取配置失败, 请检查数据库连接`
  }

  public get defaultConfig() {
    return generateDefaultConfig()
  }

  protected async configInit() {
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
    this.configInitd = true
  }

  public get<T extends keyof IConfig>(key: T): Promise<Readonly<IConfig[T]>> {
    return new Promise((resolve, reject) => {
      this.waitForConfigReady()
        .then((config) => {
          resolve(config[key])
        })
        .catch(reject)
    })
  }

  // Config 在此收口
  public async getConfig(errorRetryCount = 3): Promise<Readonly<IConfig>> {
    const configCache = await this.redisService
      .getClient()
      .get(getRedisKey(RedisKeys.ConfigCache))

    if (configCache) {
      try {
        const instanceConfigsValue = plainToInstance<IConfig, any>(
          IConfig as any,
          JSON.parse(configCache) as any,
        ) as any as IConfig

        return decryptObject(instanceConfigsValue)
      } catch (error) {
        await this.configInit()
        if (errorRetryCount > 0) {
          return await this.getConfig(--errorRetryCount)
        }
        this.logger.error('获取配置失败')
        throw error
      }
    } else {
      await this.configInit()

      return await this.getConfig()
    }
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

    const dto = configDtoMapping[key]
    if (!dto) {
      throw new BadRequestException('设置不存在')
    }
    const instanceValue = this.validWithDto(dto, value)

    encryptObject(instanceValue)

    switch (key) {
      case 'url': {
        const newValue = await this.patch(key, instanceValue)
        this.subpub.publish(EventBusEvents.AppUrlChanged, newValue)
        return newValue
      }
      case 'mailOptions': {
        const option = await this.patch(key as 'mailOptions', instanceValue)
        if (option.enable) {
          if (cluster.isPrimary) {
            this.eventManager.emit(EventBusEvents.EmailInit, null, {
              scope: EventScope.TO_SYSTEM,
            })
          } else {
            this.subpub.publish(EventBusEvents.EmailInit, '')
          }
        }

        return option
      }

      case 'algoliaSearchOptions': {
        const option = await this.patch(
          key as 'algoliaSearchOptions',
          instanceValue,
        )
        if (option.enable) {
          this.eventManager.emit(EventBusEvents.PushSearch, null, {
            scope: EventScope.TO_SYSTEM,
          })
        }
        return option
      }

      case 'oauth': {
        const value = instanceValue as OAuthDto
        const current = await this.get('oauth')

        const currentProvidersMap = current.providers.reduce(
          (acc, item) => {
            acc[item.type] = item
            return acc
          },
          {} as Record<string, any>,
        )

        value.providers.forEach((p) => {
          if (!currentProvidersMap[p.type]) {
            current.providers.push(p)
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
          providers: current.providers,
          secrets: nextAuthSecrets,
          public: nextAuthPublic,
        })

        this.subpub.publish(EventBusEvents.OauthChanged, option)
        return option
      }

      default: {
        return this.patch(key, instanceValue)
      }
    }
  }

  private validWithDto<T extends object>(dto: ClassConstructor<T>, value: any) {
    const validModel = plainToInstance(dto, value)
    const errors = Array.isArray(validModel)
      ? (validModel as Array<any>).reduce(
          (acc, item) =>
            acc.concat(validateSync(item, ExtendedValidationPipe.options)),
          [],
        )
      : validateSync(validModel, ExtendedValidationPipe.options)
    if (errors.length > 0) {
      const error = this.validate.createExceptionFactory()(errors as any[])
      throw error
    }
    return validModel
  }
}
