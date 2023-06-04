// TODO  extract logic
import cluster from 'cluster'
import { render } from 'ejs'
import { createTransport } from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BizException } from '~/common/exceptions/biz.exception'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'

import { SubPubBridgeService } from '../redis/subpub.service'
import { AssetService } from './helper.asset.service'

export enum ReplyMailType {
  Owner = 'owner',
  Guest = 'guest',
}

export enum NewsletterMailType {
  Newsletter = 'newsletter',
}

export enum LinkApplyEmailType {
  ToMaster,
  ToCandidate,
}

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private instance: ReturnType<typeof createTransport>
  private logger: Logger
  constructor(
    private readonly configsService: ConfigsService,
    private readonly assetService: AssetService,
    private readonly subpub: SubPubBridgeService,
  ) {
    this.logger = new Logger(EmailService.name)
  }

  async onModuleInit() {
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

  async readTemplate(
    type: ReplyMailType | NewsletterMailType,
  ): Promise<string> {
    switch (type) {
      case ReplyMailType.Guest:
        return this.assetService.getAsset(
          '/email-template/guest.template.ejs',
          { encoding: 'utf-8' },
        ) as Promise<string>
      case ReplyMailType.Owner:
        return this.assetService.getAsset(
          '/email-template/owner.template.ejs',
          { encoding: 'utf-8' },
        ) as Promise<string>
      case NewsletterMailType.Newsletter:
        return this.assetService.getAsset(
          '/email-template/newsletter.template.ejs',
          { encoding: 'utf-8' },
        ) as Promise<string>
    }
  }

  async writeTemplate(
    type: ReplyMailType | NewsletterMailType,
    source: string,
  ) {
    switch (type) {
      case ReplyMailType.Guest:
        return this.assetService.writeUserCustomAsset(
          '/email-template/guest.template.ejs',
          source,
          { encoding: 'utf-8' },
        )
      case ReplyMailType.Owner:
        return this.assetService.writeUserCustomAsset(
          '/email-template/owner.template.ejs',
          source,
          { encoding: 'utf-8' },
        )
      case NewsletterMailType.Newsletter:
        return this.assetService.writeUserCustomAsset(
          '/email-template/newsletter.template.ejs',
          source,
          { encoding: 'utf-8' },
        )
    }
  }

  async deleteTemplate(type: ReplyMailType | NewsletterMailType) {
    switch (type) {
      case ReplyMailType.Guest:
        await this.assetService.removeUserCustomAsset(
          '/email-template/guest.template.ejs',
        )
        break
      case ReplyMailType.Owner:
        await this.assetService.removeUserCustomAsset(
          '/email-template/owner.template.ejs',
        )
        break
      case NewsletterMailType.Newsletter:
        await this.assetService.removeUserCustomAsset(
          '/email-template/newsletter.template.ejs',
        )
        break
    }
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
          secure: true,
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
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .catch(() => {})
  }

  private getConfigFromConfigService() {
    return new Promise<{
      host: string
      port: number
      auth: { user: string; pass: string }
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
          port: parseInt((options?.port as any) || '465'),
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

  async sendCommentNotificationMail({
    to,
    source,
    type,
  }: {
    to: string
    source: CommentEmailTemplateRenderProps
    type: ReplyMailType
  }) {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { user } = mailOptions
    const from = `"${seo.title || 'Mx Space'}" <${user}>`

    source.ip ??= ''
    if (type === ReplyMailType.Guest) {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 主人给你了新的回复呐`,
          to,
          html: render((await this.readTemplate(type)) as string, source),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.send(options)
    } else {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 有新回复了耶~`,
          to,
          html: render((await this.readTemplate(type)) as string, source),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.send(options)
    }
  }

  async sendTestEmail() {
    const master = await this.configsService.getMaster()
    const mailOptons = await this.configsService.get('mailOptions')
    return this.instance.sendMail({
      from: `"Mx Space" <${mailOptons.user}>`,
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
    } catch (err) {
      this.logger.warn(err.message)
      throw new BizException('邮件发送失败')
    }
  }
}

export interface CommentEmailTemplateRenderProps {
  author: string
  ip?: string
  text: string
  link: string
  time: string
  mail: string
  title: string
  master?: string
}

export interface NewsletterTemplateRenderProps {
  author: string
  title: string
  text: string
  detail_link: string
  unsubscribe_link: string
  master: string
}
