import cluster from 'node:cluster'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'
import { createTransport } from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import { Resend } from 'resend'
import { SubPubBridgeService } from '../redis/subpub.service'
import { AssetService } from './helper.asset.service'

type MailProvider = 'smtp' | 'resend'
type MailClient = {
  sendMail: (options: Mail.Options) => Promise<any>
  verify?: (callback: (error?: Error | null) => void) => void
  close?: () => void
}

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private instance?: MailClient
  private provider: MailProvider = 'smtp'
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
    this.instance = undefined
  }

  @OnEvent(EventBusEvents.EmailInit)
  init() {
    this.configsService
      .waitForConfigReady()
      .then(({ mailOptions }) => {
        this.teardown()
        this.provider = (mailOptions.provider || 'smtp') as MailProvider

        if (this.provider === 'resend') {
          const apiKey = mailOptions.resend?.apiKey
          if (!apiKey) {
            this.logger.warn('Resend API Key 未配置，邮件服务未启动')
            return
          }
          const resend = new Resend(apiKey)
          this.instance = {
            sendMail: async (options: Mail.Options) => {
              const from = this.normalizeSingleAddress(
                options.from as unknown as
                  | string
                  | Mail.Address
                  | Array<string | Mail.Address>
                  | undefined,
              )
              const to = this.normalizeAddressList(options.to)
              if (!from || !to) {
                throw new BizException('邮件发送失败')
              }
              const cc = this.normalizeAddressList(options.cc)
              const bcc = this.normalizeAddressList(options.bcc)
              const replyTo = this.normalizeSingleAddress(options.replyTo)
              const html =
                this.normalizeContent(options.html) ||
                this.normalizeContent(options.text)
              if (!html) {
                throw new BizException('邮件发送失败')
              }

              return resend.emails.send({
                from,
                to,
                subject: options.subject as string,
                html,
                text: this.normalizeContent(options.text),
                cc,
                bcc,
                replyTo,
                headers: options.headers as Record<string, string> | undefined,
              })
            },
          }
        } else {
          const { smtp } = mailOptions
          const { user, pass, options } = smtp || {}
          if (!user && !pass) {
            const message = '未启动邮件通知'
            this.logger.warn(message)
            return
          }
          this.instance = createTransport({
            host: options?.host || '',
            port: Number.parseInt((options?.port as any) || '465'),
            secure: options?.secure,
            auth: { user, pass },
            tls: {
              rejectUnauthorized: false,
            },
          })
        }

        this.checkIsReady().then((ready) => {
          if (ready) {
            this.logger.log('送信服务已经加载完毕！')
          }
        })
      })
      .catch(() => {})
  }

  async checkIsReady() {
    if (!this.instance) {
      return false
    }
    if (this.provider === 'resend') {
      return true
    }
    return await this.verifyClient()
  }

  // 验证有效性
  private verifyClient() {
    return new Promise<boolean>((r) => {
      if (!this.instance?.verify) {
        r(false)
        return
      }
      this.instance.verify((error) => {
        if (error) {
          this.logger.error('邮件客户端初始化连接失败！', error.message)
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
    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    return this.instance?.sendMail({
      from: `"Mx Space" <${senderEmail}>`,
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
      if (!this.instance) {
        throw new Error('邮件服务未初始化')
      }
      return await this.instance.sendMail(options)
    } catch (error) {
      this.logger.warn(error.message)
      throw new BizException('邮件发送失败')
    }
  }

  private normalizeSingleAddress(
    input: string | Mail.Address | Array<string | Mail.Address> | undefined,
  ): string | undefined {
    if (!input) {
      return undefined
    }
    if (typeof input === 'string') {
      return input
    }
    if (Array.isArray(input)) {
      const value = input
        .map((item) => (typeof item === 'string' ? item : item.address))
        .find(Boolean)
      return value
    }
    return input.address
  }

  private normalizeAddressList(
    input: string | Mail.Address | Array<string | Mail.Address> | undefined,
  ): string | string[] | undefined {
    if (!input) {
      return undefined
    }
    if (typeof input === 'string') {
      return input
    }
    if (Array.isArray(input)) {
      const list = input
        .map((item) => (typeof item === 'string' ? item : item.address))
        .filter(Boolean)
      if (list.length === 0) {
        return undefined
      }
      return list.length === 1 ? list[0] : list
    }
    return input.address
  }

  private normalizeContent(input: unknown): string | undefined {
    if (!input) {
      return undefined
    }
    if (typeof input === 'string') {
      return input
    }
    if (Buffer.isBuffer(input)) {
      return input.toString()
    }
    return undefined
  }
}
