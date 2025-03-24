import cluster from 'node:cluster'
import { createTransport } from 'nodemailer'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type Mail from 'nodemailer/lib/mailer'

import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'

import { SubPubBridgeService } from '../redis/subpub.service'
import { AssetService } from './helper.asset.service'

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private instance: ReturnType<typeof createTransport>
  private logger: Logger
  constructor(
    private readonly configsService: ConfigsService,
    private readonly assetService: AssetService,
    private readonly subpub: SubPubBridgeService,
    private readonly userService: UserService,
  ) {
    this.logger = new Logger(EmailService.name)
  }

  onModuleInit() {
    this.init()
    if (cluster.isWorker) {
      this.subpub.subscribe(EventBusEvents.EmailInit, () => {
        this.init()
      })
    }
  }

  onModuleDestroy() {
    this.teardown()
  }

  private emailTypeMap = {}
  private emailTypeSet = new Set()

  public registerEmailType(
    type: string,
    exampleRenderProps: Record<string, any>,
  ) {
    if (this.emailTypeSet.has(type)) {
      this.logger.warn(`重复注册邮件类型 ${type}`)
      return
    }
    this.emailTypeMap[type] = exampleRenderProps || {}
    this.emailTypeSet.add(type)
  }

  public getExampleRenderProps(type: string) {
    const props = this.emailTypeMap[type]
    if (!props) throw new BizException(ErrorCodeEnum.EmailTemplateNotFound)
    return props
  }

  readTemplate(type: string): Promise<string> {
    return this.assetService.getAsset(`/email-template/${type}.template.ejs`, {
      encoding: 'utf-8',
    }) as Promise<string>
  }

  writeTemplate(type: string, source: string) {
    return this.assetService.writeUserCustomAsset(
      `/email-template/${type}.template.ejs`,
      source,
      {
        encoding: 'utf-8',
      },
    )
  }

  async deleteTemplate(type: string) {
    await this.assetService
      .removeUserCustomAsset(`/email-template/${type}.template.ejs`)
      .catch((error) => {
        if ((error?.message as string).includes('no such file or directory'))
          return
        throw error
      })
  }

  teardown() {
    this.instance?.close?.()
  }

  @OnEvent(EventBusEvents.EmailInit)
  init() {
    this.getConfigFromConfigService()
      .then((config) => {
        this.teardown()
        this.instance = createTransport({
          ...config,
          tls: {
            rejectUnauthorized: false,
          },
        })
        this.checkIsReady().then((ready) => {
          if (ready) {
            this.logger.log('送信服务已经加载完毕！')
          }
        })
      })

      .catch(() => {})
  }

  private getConfigFromConfigService() {
    return new Promise<{
      host: string
      port: number
      auth: { user: string; pass: string }
      secure: boolean
    }>((r, j) => {
      this.configsService.waitForConfigReady().then(({ mailOptions }) => {
        const { options, user, pass } = mailOptions
        if (!user && !pass) {
          const message = '未启动邮件通知'
          this.logger.warn(message)
          return j(message)
        }
        // @ts-ignore
        r({
          host: options?.host,
          port: Number.parseInt((options?.port as any) || '465'),
          auth: { user, pass },
        } as const)
      })
    })
  }

  async checkIsReady() {
    return !!this.instance && (await this.verifyClient())
  }

  // 验证有效性
  private verifyClient() {
    return new Promise<boolean>((r) => {
      this.instance.verify((error) => {
        if (error) {
          this.logger.error('邮件客户端初始化连接失败！')
          r(false)
        } else {
          r(true)
        }
      })
    })
  }

  async sendTestEmail() {
    const master = await this.userService.getMaster()
    const mailOptions = await this.configsService.get('mailOptions')
    return this.instance.sendMail({
      from: `"Mx Space" <${mailOptions.from || mailOptions.user}>`,
      to: master.mail,
      subject: '测试邮件',
      text: '这是一封测试邮件',
    })
  }

  getInstance() {
    return this.instance
  }

  async send(options: Mail.Options) {
    try {
      return await this.instance.sendMail(options)
    } catch (error) {
      this.logger.warn(error.message)
      throw new BizException('邮件发送失败')
    }
  }
}
