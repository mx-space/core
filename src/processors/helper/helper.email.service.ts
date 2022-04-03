// TODO  extract logic
import cluster from 'cluster'
import { render } from 'ejs'
import { createTransport } from 'nodemailer'

import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'

import { CacheService } from '../cache/cache.service'
import { AssetService } from './helper.asset.service'

export enum ReplyMailType {
  Owner = 'owner',
  Guest = 'guest',
}

export enum LinkApplyEmailType {
  ToMaster,
  ToCandidate,
}

@Injectable()
export class EmailService {
  private instance: ReturnType<typeof createTransport>
  private logger: Logger
  constructor(
    private readonly configsService: ConfigsService,
    private readonly assetService: AssetService,
    private readonly cacheService: CacheService,
  ) {
    this.init()
    this.logger = new Logger(EmailService.name)

    if (cluster.isWorker) {
      cacheService.subscribe(EventBusEvents.EmailInit, () => {
        this.init()
      })
    }
  }

  async readTemplate(type: ReplyMailType) {
    switch (type) {
      case ReplyMailType.Guest:
        return this.assetService.getAsset(
          '/email-template/guest.template.ejs',
          { encoding: 'utf-8' },
        )
      case ReplyMailType.Owner:
        return this.assetService.getAsset(
          '/email-template/owner.template.ejs',
          { encoding: 'utf-8' },
        )
    }
  }

  async writeTemplate(type: ReplyMailType, source: string) {
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
    }
  }

  async deleteTemplate(type: ReplyMailType) {
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
    }
  }
  @OnEvent(EventBusEvents.EmailInit)
  init() {
    this.getConfigFromConfigService()
      .then((config) => {
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
          const message = '邮件件客户端未认证'
          this.logger.error(message)
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
    return new Promise<boolean>((r, j) => {
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
    source: EmailTemplateRenderProps
    type: ReplyMailType
  }) {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { user } = mailOptions
    const from = `"${seo.title || 'Mx Space'}" <${user}>`
    if (type === ReplyMailType.Guest) {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 主人给你了新的回复呐`,
          to,
          html: this.render((await this.readTemplate(type)) as string, source),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.instance.sendMail(options)
    } else {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 有新回复了耶~`,
          to,
          html: this.render((await this.readTemplate(type)) as string, source),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.instance.sendMail(options)
    }
  }

  render(template: string, source: EmailTemplateRenderProps) {
    return render(template, {
      text: source.text,
      time: source.time,
      author: source.author,
      link: source.link,
      ip: source.ip || '',
      title: source.title,
      master: source.master,
      mail: source.mail,
    } as EmailTemplateRenderProps)
  }

  getInstance() {
    return this.instance
  }
}

export interface EmailTemplateRenderProps {
  author: string
  ip?: string
  text: string
  link: string
  time: string
  mail: string
  title: string
  master?: string
}
