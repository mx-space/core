import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { ReturnModelType } from '@typegoose/typegoose'
import { cloneDeep } from 'lodash'
import { InjectModel } from 'nestjs-typegoose'
import { sleep } from '~/utils/index.util'
import { UserService } from '../user/user.service'
import { BackupOptionsDto, MailOptionsDto } from './configs.dto'
import { IConfig } from './configs.interface'
import { OptionModel } from './configs.model'

const generateDefaultConfig: () => IConfig = () => ({
  seo: {
    title: 'mx-space',
    description: 'Hello World~',
  },
  url: {
    wsUrl: 'http://localhost:2333', //todo
    adminUrl: 'http://localhost:9528',
    serverUrl: 'http://localhost:2333',
    webUrl: 'http://localhost:2323',
  },
  mailOptions: {} as MailOptionsDto,
  commentOptions: { antiSpam: false },
  backupOptions: { enable: false } as BackupOptionsDto,
  baiduSearchOptions: { enable: false },
  algoliaSearchOptions: { enable: false, apiKey: '', appId: '', indexName: '' },
  adminExtra: {
    background:
      'https://gitee.com/xun7788/my-imagination/raw/master/images/88426823_p0.jpg',
    gaodemapKey: null,
  },
})

@Injectable()
export class ConfigsService {
  private config: IConfig = generateDefaultConfig()
  private logger: Logger
  constructor(
    @InjectModel(OptionModel)
    private readonly optionModel: ReturnModelType<typeof OptionModel>,
    private readonly userService: UserService,
  ) {
    this.configInit().then(() => {
      this.logger.log('Config 已经加载完毕！')
    })
    this.logger = new Logger(ConfigsService.name)
  }
  private configInitd = false

  public waitForConfigReady() {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<Readonly<IConfig>>(async (r, j) => {
      // 开始等待, 后续调用直接返回
      if (this.configInitd) {
        r(this.getConfig())
        return
      }

      const maxCount = 10
      let curCount = 0
      do {
        if (this.configInitd) {
          r(this.getConfig())
          return
        }
        await sleep(100)
        curCount += 1
      } while (curCount < maxCount)

      j(`重试 ${curCount} 次获取配置失败, 请检查数据库连接`)

      return
    })
  }

  protected async configInit() {
    const configs = await this.optionModel.find().lean()
    configs.forEach((field) => {
      const name = field.name as keyof IConfig
      const value = field.value
      this.config[name] = value
    })
    this.configInitd = true
  }

  // 10 分钟自动同步一次
  @Interval(1000 * 60 * 10)
  private async syncConfig() {
    this.configInitd = false
    this.config = generateDefaultConfig() as any
    await this.configInit()
    this.logger.log('Config 已经同步完毕！')
  }

  public get<T extends keyof IConfig>(key: T): Readonly<IConfig[T]> {
    if (!this.configInitd) {
      throw new InternalServerErrorException('Config 未初始化')
    }
    return cloneDeep(this.config[key]) as Readonly<IConfig[T]>
  }
  public getConfig(): Readonly<IConfig> {
    return cloneDeep(this.config)
  }

  public async patch<T extends keyof IConfig>(key: T, data: IConfig[T]) {
    await this.optionModel.updateOne(
      { name: key as string },
      { value: { ...this.config[key], ...data } },
      { upsert: true, omitUndefined: true },
    )
    const newData = (await this.optionModel.findOne({ name: key as string }))
      .value

    this.config[key] = newData

    return cloneDeep(this.config[key])
  }

  get getMaster() {
    // HINT: 需要注入 this 的指向
    return this.userService.getMaster.bind(this.userService)
  }
}
