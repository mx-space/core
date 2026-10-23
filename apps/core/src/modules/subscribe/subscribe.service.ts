import cluster from 'node:cluster'
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

import type { CoAction } from '@innei/next-async'
import { Co } from '@innei/next-async'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import ejs from 'ejs'
import { LRUCache } from 'lru-cache'
import type Mail from 'nodemailer/lib/mailer'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { isMainProcess } from '~/global/env.global'
import { DatabaseService } from '~/processors/database/database.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { truncateAtBoundary } from '~/utils/text-summary.util'

import { ConfigsService } from '../configs/configs.service'
import type { NoteModel } from '../note/note.types'
import { OwnerService } from '../owner/owner.service'
import type { PostModel } from '../post/post.types'
import {
  SubscribeNoteCreateBit,
  SubscribePostCreateBit,
  SubscribeTypeToBitMap,
} from './subscribe.constant'
import type { SubscribeTemplateRenderProps } from './subscribe.email.default'
import { defaultSubscribeForRenderProps } from './subscribe.email.default'
import { SubscribeRepository } from './subscribe.repository'
import { SubscribeMailType } from './subscribe-mail.enum'

@Injectable()
export class SubscribeService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly subscribeRepository: SubscribeRepository,
    private readonly eventManager: EventManagerService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly urlBuilderService: UrlBuilderService,
    private readonly emailService: EmailService,
    private readonly ownerService: OwnerService,
    private readonly redis: RedisService,
  ) {}

  public get repository() {
    return this.subscribeRepository
  }

  list(page: number, size: number) {
    return this.subscribeRepository.list(page, size)
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
    const owner = await this.ownerService.getSiteOwnerOrMocked()
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

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    const resolveDocument = async (payload: { id: string }) => {
      const result = await self.databaseService.findGlobalById(payload.id)
      if (!result) return null
      return result.document as NoteModel | PostModel
    }

    const noteAndPostHandler: CoAction<never> = async function (
      noteOrPost: NoteModel | PostModel,
    ) {
      const owner = await self.ownerService.getOwner()
      const isNote = self.urlBuilderService.isNoteModel(noteOrPost)
      const subscribeBit = isNote
        ? SubscribeNoteCreateBit
        : SubscribePostCreateBit
      const { serverUrl } = await self.configService.get('url')
      const detailLink =
        await self.urlBuilderService.buildWithBaseUrl(noteOrPost)
      const subscribers = await self.subscribeRepository.findAll()
      for (const { email, subscribe, cancelToken, verified } of subscribers) {
        if (!verified) continue
        if (!(subscribe & subscribeBit)) continue
        const unsubscribeLink = `${serverUrl.replace(/\/$/, '')}${apiRoutePrefix}/subscribe/unsubscribe?email=${encodeURIComponent(email)}&cancelToken=${encodeURIComponent(cancelToken)}`
        self.sendEmail(
          email,
          {
            author: owner.name,
            detail_link: detailLink,
            text: truncateAtBoundary(noteOrPost.text, 150),
            title: noteOrPost.title,
            unsubscribe_link: unsubscribeLink,
            owner: owner.name,
            aggregate: {
              owner,
              subscriber: { subscribe, email },
              post: {
                text: noteOrPost.text,
                created: new Date(noteOrPost.createdAt!).toISOString(),
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
      if ('isPublished' in noteOrPost && !noteOrPost.isPublished)
        return this.abort()
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

    const handleEvent = async (e: { id: string }) => {
      const doc = await resolveDocument(e)
      if (!doc) return
      new Co().use(precheck, noteAndPostHandler).start(doc)
    }

    const publicContentEvents = new Set<string>([
      BusinessEvents.NOTE_CREATE,
      BusinessEvents.NOTE_REPUBLISH,
      BusinessEvents.POST_CREATE,
      BusinessEvents.POST_REPUBLISH,
    ])

    return [
      this.eventManager.registerHandler((event, data, scope) => {
        if ((scope & EventScope.TO_VISITOR) === 0) return
        if (!publicContentEvents.has(event)) return
        void handleEvent(data)
      }),
    ]
  }

  async subscribe(email: string, subscribe: number) {
    email = email.trim().toLowerCase()
    const emailHash = createHash('sha256').update(email).digest('hex')
    const admitted = await this.redis
      .getClient()
      .set(getRedisKey(`subscribe:confirm:${emailHash}`), '1', 'EX', 60, 'NX')
    if (!admitted) return
    let subscriber = await this.subscribeRepository.findByEmail(email)
    if (!subscriber) {
      subscriber = await this.subscribeRepository.create({
        email,
        cancelToken: this.createCancelToken(email),
        subscribe: 0,
        verified: false,
      })
    }
    const expires = Date.now() + 15 * 60_000
    const payload = `${expires}.${subscribe}`
    const signature = createHmac('sha256', subscriber.cancelToken)
      .update(`${email}.${payload}`)
      .digest('hex')
    const { serverUrl } = await this.configService.get('url')
    const { mailOptions } = await this.configService.waitForConfigReady()
    const url = new URL(
      `${serverUrl.replace(/\/$/, '')}${apiRoutePrefix}/subscribe/confirm`,
    )
    url.searchParams.set('email', email)
    url.searchParams.set('token', `${payload}.${signature}`)
    await this.emailService.send({
      from: mailOptions.from || mailOptions.smtp?.user,
      to: email,
      subject: 'Confirm your email subscription',
      text: `Confirm your subscription or preference change within 15 minutes:\n${url.toString()}\nIgnore this email if you did not request it.`,
    })
  }

  async confirm(email: string, token: string) {
    email = email.trim().toLowerCase()
    const subscriber = await this.subscribeRepository.findByEmail(email)
    const [expires, bit, signature] = token.split('.')
    const subscribe = Number(bit)
    const allowedBits = Object.values(SubscribeTypeToBitMap).reduce(
      (a, b) => a | b,
      0,
    )
    if (
      !subscriber ||
      !/^\d+$/.test(expires) ||
      Number(expires) <= Date.now() ||
      !Number.isSafeInteger(subscribe) ||
      subscribe <= 0 ||
      subscribe > allowedBits ||
      (subscribe & ~allowedBits) !== 0 ||
      !/^[\da-f]{64}$/.test(signature ?? '')
    ) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER)
    }
    const expected = createHmac('sha256', subscriber.cancelToken)
      .update(`${email}.${expires}.${bit}`)
      .digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw createAppException(AppErrorCode.INVALID_PARAMETER)
    await this.subscribeRepository.updateByEmail(email, {
      subscribe,
      verified: true,
    })
    return true
  }

  async unsubscribe(email: string, token: string) {
    const model = await this.subscribeRepository.findByEmail(email)
    if (!model) return false
    if (model.cancelToken === token) {
      await this.subscribeRepository.deleteByEmail(email)
      return true
    }
    return false
  }

  async unsubscribeBatch(emails?: string[], all?: boolean) {
    if (all) {
      const count = await this.subscribeRepository.deleteAll()
      return count
    }
    if (!emails?.length) return 0

    const count = await this.subscribeRepository.deleteByEmails(emails)
    return count
  }

  createCancelToken(_email: string) {
    return randomBytes(32).toString('hex')
  }

  subscribeTypeToBit(type: keyof typeof SubscribeTypeToBitMap) {
    if (!Object.keys(SubscribeTypeToBitMap).includes(type))
      throw createAppException(AppErrorCode.INVALID_SUBSCRIBE_TYPE)
    return SubscribeTypeToBitMap[type]
  }

  private lruCache = new LRUCache<string, any>({ ttl: 20000, max: 2 })

  async sendEmail(
    email: string,
    source: SubscribeTemplateRenderProps,
    unsubscribeLink: string,
  ) {
    const { seo, mailOptions } = await this.configService.waitForConfigReady()
    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    const sendfrom = `"${seo.title || 'Mix Space'}" <${senderEmail}>`
    const cacheKey = 'template'
    let finalTemplate = this.lruCache.get(cacheKey)
    if (!finalTemplate) {
      finalTemplate = await this.emailService.readTemplate(
        SubscribeMailType.Newsletter,
      )
      this.lruCache.set(cacheKey, finalTemplate)
    }

    const options: Mail.Options = {
      from: sendfrom,
      subject: `[${seo.title || 'Mix Space'}] New content published`,
      to: email,
      html: ejs.render(finalTemplate, source),
      headers: { 'List-Unsubscribe': `<${unsubscribeLink}>` },
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
