import cluster from 'cluster'
import { render } from 'ejs'
import { nanoid } from 'nanoid'
import type { CoAction } from '@innei/next-async/types/interface'
import type { OnModuleInit } from '@nestjs/common'
import type { NewsletterTemplateRenderProps } from '~/processors/helper/helper.email.service'
import type { NoteModel } from '../note/note.model'
import type { PostModel } from '../post/post.model'

import { Co } from '@innei/next-async'
import { BadRequestException, Injectable } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isMainProcess } from '~/global/env.global'
import {
  EmailService,
  NewsletterMailType,
} from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { InjectModel } from '~/transformers/model.transformer'
import { hashString, md5 } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import {
  SubscribeNoteCreateBit,
  SubscribePostCreateBit,
  SubscribeTypeToBitMap,
} from './subscribe.constant'
import { SubscribeModel } from './subscribe.model'

declare type Email = string
declare type Subscribe = number

@Injectable()
export class SubscribeService implements OnModuleInit {
  constructor(
    @InjectModel(SubscribeModel)
    private readonly subscribeModel: MongooseModel<SubscribeModel>,

    private readonly eventManager: EventManagerService,

    private readonly configService: ConfigsService,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly emailService: EmailService,
  ) {}

  private subscribeMap = new Map<Email, Subscribe>()
  get model() {
    return this.subscribeModel
  }

  async onModuleInit() {
    if (!isMainProcess && cluster.isWorker && cluster.worker?.id !== 1) return
    // init from db

    const models = await this.model.find().lean()

    for (const model of models) {
      this.subscribeMap.set(model.email, model.subscribe)
    }

    const scopeCfg = { scope: EventScope.TO_VISITOR }

    const getUnsubscribeLink = async (email: string) => {
      const document = await this.model.findOne({ email }).lean()

      if (!document) return ''
      const { serverUrl } = await this.configService.get('url')
      return `${serverUrl}/subscribe/unsubscribe?email=${email}&cancelToken=${document.cancelToken}`
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    const noteAndPostHandler: CoAction<never> = async function (
      noteOrPost: NoteModel | PostModel,
    ) {
      const user = await self.configService.getMaster()
      for (const [email, subscribe] of self.subscribeMap.entries()) {
        const unsubscribeLink = await getUnsubscribeLink(email)

        if (!unsubscribeLink) continue
        const isNote = self.urlBuilderService.isNoteModel(noteOrPost)

        if (
          subscribe & (isNote ? SubscribeNoteCreateBit : SubscribePostCreateBit)
        )
          self.sendEmail(email, {
            author: user.name,
            detail_link: await self.urlBuilderService.buildWithBaseUrl(
              noteOrPost,
            ),
            text: `${noteOrPost.text.slice(0, 150)}...`,
            title: noteOrPost.title,
            unsubscribe_link: unsubscribeLink,
            master: user.name,
          })
      }
    }

    const precheck: CoAction<any> = async function () {
      const enable = await self.checkEnable()

      if (enable) {
        await this.next()
        return
      }
      this.abort()
    }

    // TODO 抽离逻辑
    this.eventManager.on(
      BusinessEvents.NOTE_CREATE,
      (e) => new Co().use(precheck, noteAndPostHandler).start(e),
      scopeCfg,
    )

    this.eventManager.on(
      BusinessEvents.POST_CREATE,
      (e) => new Co().use(precheck, noteAndPostHandler).start(e),
      scopeCfg,
    )

    // this.eventManager.on(
    //   BusinessEvents.SAY_CREATE,
    //   async (say: SayModel) => {
    //     for (const [email, subscribe] of this.subscribeMap.entries()) {
    //       const unsubscribeLink = await getUnsubscribeLink(email)

    //       if (!unsubscribeLink) continue

    //       if (subscribe & SubscribeNoteCreateBit) this.sendEmail(email, {
    //         author: user.name,
    //         detail_link: this.urlBuilderService.buildWithBaseUrl
    //       })
    //     }
    //   },
    //   scopeCfg,
    // )

    // this.eventManager.on(
    //   BusinessEvents.RECENTLY_CREATE,
    //   async () => {},
    //   scopeCfg,
    // )
  }

  async subscribe(email: string, subscribe: number) {
    const isExist = await this.model
      .findOne({
        email,
      })
      .lean()

    if (isExist) {
      await this.model.updateOne(
        {
          email,
        },
        {
          $set: {
            subscribe,
          },
        },
      )
    } else {
      const token = this.createCancelToken(email)
      await this.model.create({
        email,
        subscribe,
        cancelToken: token,
      })
    }

    this.subscribeMap.set(email, subscribe)

    // event subscribe update
  }

  async unsubscribe(email: string, token: string) {
    const model = await this.model
      .findOne({
        email,
      })
      .lean()
    if (!model) {
      return false
    }
    if (model.cancelToken === token) {
      await this.model.deleteOne({ email })

      this.subscribeMap.delete(email)

      return true
    }
  }

  createCancelToken(email: string) {
    return hashString(md5(email) + nanoid(8))
  }

  subscribeTypeToBit(type: keyof typeof SubscribeTypeToBitMap) {
    if (!Object.keys(SubscribeTypeToBitMap).includes(type))
      throw new BadRequestException('subscribe type is not valid')
    return SubscribeTypeToBitMap[type]
  }

  async sendEmail(email: string, source: NewsletterTemplateRenderProps) {
    const { seo, mailOptions } = await this.configService.waitForConfigReady()
    const { user } = mailOptions
    const from = `"${seo.title || 'Mx Space'}" <${user}>`

    const options = {
      from,
      ...{
        subject: `[${seo.title || 'Mx Space'}] 发布了新内容~`,
        to: email,
        html: render(
          (await this.emailService.readTemplate(
            NewsletterMailType.Newsletter,
          )) as string,
          source,
        ),
      },
    }

    // console.debug(`send: `, options, `to: ${email}`)

    await this.emailService.send(options)
  }

  async checkEnable() {
    const {
      featureList: { emailSubscribe },
      mailOptions: { enable },
    } = await this.configService.waitForConfigReady()

    return emailSubscribe && enable
  }
}
