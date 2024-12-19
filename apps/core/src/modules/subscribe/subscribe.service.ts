import cluster from 'node:cluster'
import { render } from 'ejs'
import { LRUCache } from 'lru-cache'
import type { CoAction } from '@innei/next-async/types/interface'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import type Mail from 'nodemailer/lib/mailer'
import type { NoteModel } from '../note/note.model'
import type { PostModel } from '../post/post.model'
import type { SubscribeTemplateRenderProps } from './subscribe.email.default'

import { Co } from '@innei/next-async'
import { nanoid as N } from '@mx-space/compiled'
import { BadRequestException, Injectable } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isMainProcess } from '~/global/env.global'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { InjectModel } from '~/transformers/model.transformer'
import { hashString, md5 } from '~/utils/tool.util'

import { ConfigsService } from '../configs/configs.service'
import { UserService } from '../user/user.service'
import { SubscribeMailType } from './subscribe-mail.enum'
import {
  SubscribeNoteCreateBit,
  SubscribePostCreateBit,
  SubscribeTypeToBitMap,
} from './subscribe.constant'
import { defaultSubscribeForRenderProps } from './subscribe.email.default'
import { SubscribeModel } from './subscribe.model'

const { nanoid } = N

declare type Email = string
declare type SubscribeBit = number

@Injectable()
export class SubscribeService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectModel(SubscribeModel)
    private readonly subscribeModel: MongooseModel<SubscribeModel>,

    private readonly eventManager: EventManagerService,

    private readonly configService: ConfigsService,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}

  private subscribeMap = new Map<Email, SubscribeBit>()
  get model() {
    return this.subscribeModel
  }

  private eventDispose: IEventManagerHandlerDisposer[] = []
  async onModuleInit() {
    const [disposer] = await Promise.all([
      this.observeEvents(),
      this.registerEmailTemplate(),
    ])
    disposer && this.eventDispose.push(...disposer)
  }
  async onModuleDestroy() {
    for (const dispose of this.eventDispose) {
      dispose()
    }
  }

  private async registerEmailTemplate() {
    const owner = await this.userService.getSiteMasterOrMocked()
    const renderProps: SubscribeTemplateRenderProps = {
      ...defaultSubscribeForRenderProps,
      aggregate: {
        ...defaultSubscribeForRenderProps.aggregate,
        owner,
      },
    }
    this.emailService.registerEmailType(
      SubscribeMailType.Newsletter,
      renderProps,
    )
  }

  private async observeEvents() {
    if (!isMainProcess && cluster.isWorker && cluster.worker?.id !== 1) return
    // init from db

    const docs = await this.model.find().lean()

    for (const doc of docs) {
      this.subscribeMap.set(doc.email, doc.subscribe)
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
      const owner = await self.userService.getMaster()
      for (const [email, subscribe] of self.subscribeMap.entries()) {
        const unsubscribeLink = await getUnsubscribeLink(email)

        if (!unsubscribeLink) continue
        const isNote = self.urlBuilderService.isNoteModel(noteOrPost)

        if (
          subscribe & (isNote ? SubscribeNoteCreateBit : SubscribePostCreateBit)
        )
          self.sendEmail(
            email,
            {
              author: owner.name,
              detail_link:
                await self.urlBuilderService.buildWithBaseUrl(noteOrPost),
              text: `${noteOrPost.text.slice(0, 150)}...`,
              title: noteOrPost.title,
              unsubscribe_link: unsubscribeLink,
              master: owner.name,

              aggregate: {
                owner,
                subscriber: {
                  subscribe,
                  email,
                },
                post: {
                  text: noteOrPost.text,
                  created: new Date(noteOrPost.created!).toISOString(),
                  id: noteOrPost.id!,
                  title: noteOrPost.title,
                },
              },
            },
            unsubscribeLink,
          )
      }
    }

    const precheck: CoAction<any> = async function (
      noteOrPost: NoteModel | PostModel,
    ) {
      if ('hide' in noteOrPost && noteOrPost.hide) return this.abort()
      if ('password' in noteOrPost && !!noteOrPost.password) return this.abort()
      if (
        'publicAt' in noteOrPost &&
        noteOrPost.publicAt &&
        new Date(noteOrPost.publicAt) > new Date()
      )
        return this.abort()
      const enable = await self.checkEnable()

      if (enable) {
        await this.next()
        return
      }
      this.abort()
    }

    return [
      // TODO 抽离逻辑
      this.eventManager.on(
        BusinessEvents.NOTE_CREATE,
        (e) => new Co().use(precheck, noteAndPostHandler).start(e),
        scopeCfg,
      ),

      this.eventManager.on(
        BusinessEvents.POST_CREATE,
        (e) => new Co().use(precheck, noteAndPostHandler).start(e),
        scopeCfg,
      ),
    ]
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

  private lruCache = new LRUCache<string, any>({
    ttl: 20000,
    max: 2,
  })

  async sendEmail(
    email: string,
    source: SubscribeTemplateRenderProps,
    unsubscribeLink: string,
  ) {
    const { seo, mailOptions } = await this.configService.waitForConfigReady()
    const { user } = mailOptions
    const from = `"${seo.title || 'Mx Space'}" <${user}>`
    let finalTemplate = ''

    const cacheKey = 'template'

    const cachedEmailTemplate = this.lruCache.get(cacheKey)

    if (cachedEmailTemplate) finalTemplate = cachedEmailTemplate
    else {
      finalTemplate = await this.emailService.readTemplate(
        SubscribeMailType.Newsletter,
      )
      this.lruCache.set(cacheKey, finalTemplate)
    }

    const options: Mail.Options = {
      from,
      ...{
        subject: `[${seo.title || 'Mx Space'}] 发布了新内容~`,
        to: email,
        html: render(finalTemplate, source),
      },

      headers: {
        // https://mailtrap.io/blog/list-unsubscribe-header/

        'List-Unsubscribe': `<${unsubscribeLink}>`,
      },
    }

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
