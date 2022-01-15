import { Injectable, Logger } from '@nestjs/common'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'
import { BeAnObject } from '@typegoose/typegoose/lib/types'
import { cloneDeep, mergeWith } from 'lodash'
import { LeanDocument } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import { API_VERSION } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { sleep } from '~/utils/index.util'
import { getRedisKey } from '~/utils/redis.util'
import { UserModel } from '../user/user.model'
import { UserService } from '../user/user.service'
import { BackupOptionsDto, MailOptionsDto } from './configs.dto'
import { IConfig } from './configs.interface'
import { OptionModel } from './configs.model'

const generateDefaultConfig: () => IConfig = () => ({
  seo: {
    title: '我的小世界呀',
    description: '哈喽~欢迎光临',
  },
  url: {
    wsUrl: 'http://127.0.0.1:2333', //todo
    adminUrl: 'http://127.0.0.1:9528',
    serverUrl: isDev
      ? 'http://127.0.0.1:2333'
      : 'http://127.0.0.1:2333/api/v' + API_VERSION,
    webUrl: 'http://127.0.0.1:2323',
  },
  mailOptions: {} as MailOptionsDto,
  commentOptions: { antiSpam: false },
  backupOptions: { enable: true } as BackupOptionsDto,
  baiduSearchOptions: { enable: false },
  algoliaSearchOptions: { enable: false, apiKey: '', appId: '', indexName: '' },
  adminExtra: {
    enableAdminProxy: true,
    title: 'おかえり~',
    background:
      'https://gitee.com/xun7788/my-imagination/raw/master/images/88426823_p0.jpg',
    gaodemapKey: null,
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

  public waitForConfigReady() {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<Readonly<IConfig>>(async (r, j) => {
      // 开始等待, 后续调用直接返回
      if (this.configInitd) {
        r(await this.getConfig())
        return
      }

      const maxCount = 10
      let curCount = 0
      do {
        if (this.configInitd) {
          r(await this.getConfig())
          return
        }
        await sleep(100)
        curCount += 1
      } while (curCount < maxCount)

      j(`重试 ${curCount} 次获取配置失败, 请检查数据库连接`)

      return
    })
  }

  public get defaultConfig() {
    return generateDefaultConfig()
  }

  protected async configInit() {
    const configs = await this.optionModel.find().lean()
    const mergedConfig = generateDefaultConfig()
    configs.forEach((field) => {
      const name = field.name as keyof IConfig
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
        return JSON.parse(configCache)
      } catch {
        await this.configInit()
        return await this.getConfig()
      }
    } else {
      await this.configInit()
      return await this.getConfig()
    }
  }

  public async patch<T extends keyof IConfig>(key: T, data: IConfig[T]) {
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

  get getMaster() {
    // HINT: 需要注入 this 的指向
    return this.userService.getMaster.bind(this.userService) as () => Promise<
      LeanDocument<DocumentType<UserModel, BeAnObject>>
    >
  }
}
