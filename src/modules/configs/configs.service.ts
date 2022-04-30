import camelcaseKeys from 'camelcase-keys'
import { ClassConstructor, plainToInstance } from 'class-transformer'
import { ValidatorOptions, validateSync } from 'class-validator'
import cluster from 'cluster'
import { cloneDeep, mergeWith } from 'lodash'
import { LeanDocument } from 'mongoose'

import {
  BadRequestException,
  Injectable,
  Logger,
  ValidationPipe,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'
import { BeAnObject } from '@typegoose/typegoose/lib/types'

import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { InjectModel } from '~/transformers/model.transformer'
import { sleep } from '~/utils'
import { getRedisKey } from '~/utils/redis.util'

import * as optionDtos from '../configs/configs.dto'
import { UserModel } from '../user/user.model'
import { UserService } from '../user/user.service'
import {
  AlgoliaSearchOptionsDto,
  BackupOptionsDto,
  MailOptionsDto,
} from './configs.dto'
import { IConfig, IConfigKeys } from './configs.interface'
import { OptionModel } from './configs.model'

const allOptionKeys: Set<IConfigKeys> = new Set()
const map: Record<string, any> = Object.entries(optionDtos).reduce(
  (obj, [key, value]) => {
    const optionKey = (key.charAt(0).toLowerCase() +
      key.slice(1).replace(/Dto$/, '')) as IConfigKeys
    allOptionKeys.add(optionKey)
    return {
      ...obj,
      [`${optionKey}`]: value,
    }
  },
  {},
)

const generateDefaultConfig: () => IConfig = () => ({
  seo: {
    title: '我的小世界呀',
    description: '哈喽~欢迎光临',
  },
  url: {
    wsUrl: '', // todo
    adminUrl: '',
    serverUrl: '',
    webUrl: '',
  },
  mailOptions: {} as MailOptionsDto,
  commentOptions: { antiSpam: false },
  friendLinkOptions: { allowApply: true },
  backupOptions: { enable: true } as BackupOptionsDto,
  baiduSearchOptions: { enable: false },
  algoliaSearchOptions: { enable: false, apiKey: '', appId: '', indexName: '' },
  adminExtra: {
    enableAdminProxy: true,
    title: 'おかえり~',
    background:
      'https://gitee.com/xun7788/my-imagination/raw/master/images/88426823_p0.jpg',
    gaodemapKey: null!,
  },
  terminalOptions: {
    enable: false,
  },
  textOptions: {
    macros: false,
  },
})

@Injectable()
export class ConfigsService {
  private logger: Logger
  constructor(
    @InjectModel(OptionModel)
    private readonly optionModel: ReturnModelType<typeof OptionModel>,
    private readonly userService: UserService,
    private readonly redis: CacheService,

    private readonly eventEmitter: EventEmitter2,
  ) {
    this.configInit().then(() => {
      this.logger.log('Config 已经加载完毕！')
    })
    this.logger = new Logger(ConfigsService.name)
  }
  private configInitd = false

  private async setConfig(config: IConfig) {
    const redis = this.redis.getClient()
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

      if (!allOptionKeys.has(name)) {
        return
      }
      const value = field.value
      mergedConfig[name] = value
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
  public async getConfig(): Promise<Readonly<IConfig>> {
    const redis = this.redis.getClient()
    const configCache = await redis.get(getRedisKey(RedisKeys.ConfigCache))

    if (configCache) {
      try {
        try {
          return plainToInstance<IConfig, any>(
            IConfig as any,
            JSON.parse(configCache) as any,
          ) as any as IConfig
        } catch {
          return JSON.parse(configCache) as any
        }
      } catch {
        await this.configInit()
        return await this.getConfig()
      }
    } else {
      await this.configInit()
      return await this.getConfig()
    }
  }

  public async patch<T extends keyof IConfig>(
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
          }),
        },
        { upsert: true, new: true },
      )
      .lean()
    const newData = updatedConfigRow.value
    const mergedFullConfig = Object.assign({}, config, { [key]: newData })

    await this.setConfig(mergedFullConfig)

    return newData
  }

  validOptions: ValidatorOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  }
  validate = new ValidationPipe(this.validOptions)
  async patchAndValid<T extends keyof IConfig>(
    key: T,
    value: Partial<IConfig[T]>,
  ) {
    value = camelcaseKeys(value, { deep: true }) as any

    switch (key) {
      case 'mailOptions': {
        const option = await this.patch(
          'mailOptions',
          this.validWithDto(MailOptionsDto, value),
        )
        if (option.enable) {
          if (cluster.isPrimary) {
            this.eventEmitter.emit(EventBusEvents.EmailInit)
          } else {
            this.redis.publish(EventBusEvents.EmailInit, '')
          }
        }

        return option
      }

      case 'algoliaSearchOptions': {
        const option = await this.patch(
          'algoliaSearchOptions',
          this.validWithDto(AlgoliaSearchOptionsDto, value),
        )
        if (option.enable) {
          this.eventEmitter.emit(EventBusEvents.PushSearch)
        }
        return option
      }
      default: {
        const dto = map[key]
        if (!dto) {
          throw new BadRequestException('设置不存在')
        }
        return this.patch(key, this.validWithDto(dto, value))
      }
    }
  }

  private validWithDto<T extends object>(dto: ClassConstructor<T>, value: any) {
    const validModel = plainToInstance(dto, value)
    const errors = validateSync(validModel, this.validOptions)
    if (errors.length > 0) {
      const error = this.validate.createExceptionFactory()(errors as any[])
      throw error
    }
    return validModel
  }

  get getMaster() {
    // HINT: 需要注入 this 的指向
    return this.userService.getMaster.bind(this.userService) as () => Promise<
      LeanDocument<DocumentType<UserModel, BeAnObject>>
    >
  }
}
