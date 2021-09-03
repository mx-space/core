import { Injectable, Logger } from '@nestjs/common'
import { createTransport } from 'nodemailer'
import { ConfigsService } from '~/modules/configs/configs.service'
@Injectable()
export class EmailService {
  private instance: ReturnType<typeof createTransport>
  private logger: Logger
  constructor(private readonly configsService: ConfigsService) {
    this.init()
    this.logger = new Logger(EmailService.name)
  }

  init() {
    this.getConfigFromConfigService().then((config) => {
      this.instance = createTransport({
        ...config,
        secure: true,
        tls: {
          rejectUnauthorized: false,
        },
      })
      this.logger.log('送信服务已经加载完毕！')
    })
  }

  private getConfigFromConfigService() {
    return new Promise<{
      host: string
      port: number
      auth: { user: string; pass: string }
    }>((r) => {
      this.configsService.waitForConfigReady().then(({ mailOptions }) => {
        const { options, user, pass } = mailOptions
        r({
          host: options.host,
          port: +options.port || 465,
          auth: { user, pass },
        } as const)
      })
    })
  }

  get checkIsReady() {
    return !!this.instance
  }
}
