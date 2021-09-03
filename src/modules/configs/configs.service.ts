import { Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { UserService } from '../user/user.service'
import { BackupOptions, MailOptionsDto, SEODto, UrlDto } from './configs.dto'
import { IConfig } from './configs.interface'
import { OptionModel } from './configs.model'

const defaultConfig = {
  seo: {
    title: 'mx-space',
    description: 'Hello World~',
  },
  url: {
    wsUrl: 'http://localhost:8080', //todo
    adminUrl: 'http://localhost:9528',
    serverUrl: 'http://localhost:2333',
    webUrl: 'http://localhost:2323',
  },
  mailOptions: {} as MailOptionsDto,
  commentOptions: { antiSpam: false },
  backupOptions: { enable: false } as BackupOptions,
  baiduSearchOptions: { enable: false },
}
@Injectable()
export class ConfigsService {
  private config: IConfig = defaultConfig
  private logger: Logger
  constructor(
    @InjectModel(OptionModel)
    private readonly optionModel: ReturnModelType<typeof OptionModel>,
    private readonly userService: UserService,
  ) {
    this.configInit()
    this.logger = new Logger(ConfigsService.name)
  }
  private configInitd = false
  public waitForConfigReady() {
    return new Promise<IConfig>(async (r, j) => {
      const maxCount = 5
      let curCount = 0

      const check = () => {
        if (curCount >= maxCount) {
          j('检查数据库连接')
          timer = clearTimeout(timer)
        }
        if (this.configInitd) {
          r({ ...this.config })
          timer = clearTimeout(timer)
        } else {
          check()
        }
        curCount += 1
      }

      let timer: any = setTimeout(() => {
        check()
      }, 1000)
    })
  }

  protected async configInit() {
    const configs = await this.optionModel.find().lean()
    configs.map((field) => {
      const name = field.name as keyof IConfig
      const value = field.value
      this.config[name] = value
    })
    this.configInitd = true
    this.logger.log('Config 已经加载完毕！')
  }

  public get seo() {
    return this.config.seo
  }

  public get url() {
    return this.config.url
  }

  async setSEO(seo: SEODto) {
    return await this.patch('seo', seo)
  }

  async setUrl(url: UrlDto) {
    return await this.patch('url', url)
  }

  public get<T extends keyof IConfig>(key: T): Readonly<IConfig[T]> {
    return this.config[key] as Readonly<IConfig[T]>
  }
  public getConfig(): Readonly<IConfig> {
    return this.config
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

    return this.config[key]
  }

  get getMaster() {
    return this.userService.getMaster
  }
}
