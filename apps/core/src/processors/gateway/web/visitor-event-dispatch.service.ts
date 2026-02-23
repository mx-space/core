import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import {
  collectVisitorEventHandlers,
  hasVisitorScope,
  OnVisitorEvent,
} from '~/common/decorators/visitor-event.decorator'
import { BusinessEvents } from '~/constants/business-event.constant'
import { buildArticleRoomName } from '~/modules/activity/activity.util'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { InjectModel } from '~/transformers/model.transformer'
import { GatewayService } from '../gateway.service'
import { WebEventsGateway } from './events.gateway'

@Injectable()
export class VisitorEventDispatchService implements OnModuleInit {
  private readonly logger = new Logger(VisitorEventDispatchService.name)

  constructor(
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
    private readonly webGateway: WebEventsGateway,
    private readonly eventManager: EventManagerService,
    private readonly translationService: TranslationService,
    private readonly gatewayService: GatewayService,
  ) {}

  onModuleInit() {
    const handlers = collectVisitorEventHandlers(this)

    this.logger.log(
      `Registered ${handlers.size} visitor event handlers: [${[...handlers.keys()].join(', ')}]`,
    )

    this.eventManager.registerHandler(((
      event: string,
      data: any,
      scope: any,
    ) => {
      if (!hasVisitorScope(scope)) return
      const handler = handlers.get(event as BusinessEvents)
      if (handler) {
        this.logger.log(`Dispatching visitor event [${event}]`)
        Promise.resolve()
          .then(() => handler(data))
          .catch((err) => {
            this.logger.error(
              `Visitor event handler error [${event}]: ${err.message}`,
              err.stack,
            )
          })
      }
    }) as any)
  }

  // --- Post ---

  @OnVisitorEvent(BusinessEvents.POST_CREATE)
  async onPostCreate(payload: { id: string }) {
    const doc = await this.postModel
      .findById(payload.id)
      .populate('category')
      .lean({ getters: true })
    if (!doc) return
    this.webGateway.broadcast(BusinessEvents.POST_CREATE, doc)
  }

  @OnVisitorEvent(BusinessEvents.POST_UPDATE)
  async onPostUpdate(payload: { id: string }) {
    const doc = await this.postModel
      .findById(payload.id)
      .populate('category')
      .populate({
        path: 'related',
        select: 'title slug id _id categoryId category',
      })
      .lean({ getters: true })
    if (!doc) return

    await this.broadcastWithTranslation(
      BusinessEvents.POST_UPDATE,
      doc,
      buildArticleRoomName(doc.id),
    )
  }

  @OnVisitorEvent(BusinessEvents.POST_DELETE)
  onPostDelete(payload: { id: string }) {
    this.webGateway.broadcast(BusinessEvents.POST_DELETE, payload.id, {
      rooms: [buildArticleRoomName(payload.id)],
    })
  }

  // --- Note ---

  @OnVisitorEvent(BusinessEvents.NOTE_CREATE)
  async onNoteCreate(payload: { id: string }) {
    const doc = await this.noteModel
      .findById(payload.id)
      .lean({ getters: true })
    if (!doc) return

    if (
      doc.isPublished === false ||
      doc.password ||
      (doc.publicAt && new Date(doc.publicAt) > new Date())
    ) {
      return
    }

    this.webGateway.broadcast(BusinessEvents.NOTE_CREATE, doc)
  }

  @OnVisitorEvent(BusinessEvents.NOTE_UPDATE)
  async onNoteUpdate(payload: { id: string }) {
    const doc = await this.noteModel
      .findById(payload.id)
      .lean({ getters: true })
    if (!doc) return

    if (doc.password || doc.isPublished === false || doc.publicAt) return

    await this.broadcastWithTranslation(
      BusinessEvents.NOTE_UPDATE,
      doc,
      buildArticleRoomName(doc.id),
    )
  }

  @OnVisitorEvent(BusinessEvents.NOTE_DELETE)
  onNoteDelete(payload: { id: string }) {
    this.webGateway.broadcast(BusinessEvents.NOTE_DELETE, payload.id, {
      rooms: [buildArticleRoomName(payload.id)],
    })
  }

  // --- Page ---

  @OnVisitorEvent(BusinessEvents.PAGE_CREATE)
  async onPageCreate(payload: { id: string }) {
    const doc = await this.pageModel
      .findById(payload.id)
      .lean({ getters: true })
    if (!doc) return
    this.webGateway.broadcast(BusinessEvents.PAGE_CREATE, doc)
  }

  @OnVisitorEvent(BusinessEvents.PAGE_UPDATE)
  async onPageUpdate(payload: { id: string }) {
    const doc = await this.pageModel
      .findById(payload.id)
      .lean({ getters: true })
    if (!doc) return

    await this.broadcastWithTranslation(
      BusinessEvents.PAGE_UPDATE,
      doc,
      buildArticleRoomName(doc.id),
    )
  }

  @OnVisitorEvent(BusinessEvents.PAGE_DELETE)
  onPageDelete(payload: { id: string }) {
    this.webGateway.broadcast(BusinessEvents.PAGE_DELETE, payload.id, {
      rooms: [buildArticleRoomName(payload.id)],
    })
  }

  // --- Non-content events (pass-through) ---

  @OnVisitorEvent(BusinessEvents.COMMENT_CREATE)
  onCommentCreate(data: any) {
    this.webGateway.broadcast(BusinessEvents.COMMENT_CREATE, data)
  }

  @OnVisitorEvent(BusinessEvents.COMMENT_UPDATE)
  onCommentUpdate(data: any) {
    this.webGateway.broadcast(BusinessEvents.COMMENT_UPDATE, data)
  }

  @OnVisitorEvent(BusinessEvents.COMMENT_DELETE)
  onCommentDelete(data: any) {
    this.webGateway.broadcast(BusinessEvents.COMMENT_DELETE, data)
  }

  @OnVisitorEvent(BusinessEvents.CATEGORY_CREATE)
  onCategoryCreate(data: any) {
    this.webGateway.broadcast(BusinessEvents.CATEGORY_CREATE, data)
  }

  @OnVisitorEvent(BusinessEvents.CATEGORY_UPDATE)
  onCategoryUpdate(data: any) {
    this.webGateway.broadcast(BusinessEvents.CATEGORY_UPDATE, data)
  }

  @OnVisitorEvent(BusinessEvents.CATEGORY_DELETE)
  onCategoryDelete(data: any) {
    this.webGateway.broadcast(BusinessEvents.CATEGORY_DELETE, data)
  }

  @OnVisitorEvent(BusinessEvents.RECENTLY_CREATE)
  onRecentlyCreate(data: any) {
    this.webGateway.broadcast(BusinessEvents.RECENTLY_CREATE, data)
  }

  @OnVisitorEvent(BusinessEvents.RECENTLY_UPDATE)
  onRecentlyUpdate(data: any) {
    this.webGateway.broadcast(BusinessEvents.RECENTLY_UPDATE, data)
  }

  @OnVisitorEvent(BusinessEvents.RECENTLY_DELETE)
  onRecentlyDelete(data: any) {
    this.webGateway.broadcast(BusinessEvents.RECENTLY_DELETE, data)
  }

  // --- Say events (CRUD factory) ---

  @OnVisitorEvent(BusinessEvents.SAY_CREATE)
  onSayCreate(data: any) {
    this.webGateway.broadcast(BusinessEvents.SAY_CREATE, data)
  }

  @OnVisitorEvent(BusinessEvents.SAY_UPDATE)
  onSayUpdate(data: any) {
    this.webGateway.broadcast(BusinessEvents.SAY_UPDATE, data)
  }

  @OnVisitorEvent(BusinessEvents.SAY_DELETE)
  onSayDelete(data: any) {
    this.webGateway.broadcast(BusinessEvents.SAY_DELETE, data)
  }

  // --- Topic events (CRUD factory) ---

  @OnVisitorEvent(BusinessEvents.TOPIC_CREATE)
  onTopicCreate(data: any) {
    this.webGateway.broadcast(BusinessEvents.TOPIC_CREATE, data)
  }

  @OnVisitorEvent(BusinessEvents.TOPIC_UPDATE)
  onTopicUpdate(data: any) {
    this.webGateway.broadcast(BusinessEvents.TOPIC_UPDATE, data)
  }

  @OnVisitorEvent(BusinessEvents.TOPIC_DELETE)
  onTopicDelete(data: any) {
    this.webGateway.broadcast(BusinessEvents.TOPIC_DELETE, data)
  }

  // --- Utility events ---

  @OnVisitorEvent(BusinessEvents.CONTENT_REFRESH)
  onContentRefresh(data: any) {
    this.webGateway.broadcast(BusinessEvents.CONTENT_REFRESH, data)
  }

  // --- Translation events ---

  @OnVisitorEvent(BusinessEvents.TRANSLATION_CREATE)
  onTranslationCreate(data: any) {
    if (!data.refId) return
    this.webGateway.broadcast(BusinessEvents.TRANSLATION_CREATE, data, {
      rooms: [buildArticleRoomName(data.refId)],
    })
  }

  @OnVisitorEvent(BusinessEvents.TRANSLATION_UPDATE)
  onTranslationUpdate(data: any) {
    if (!data.refId) return
    this.webGateway.broadcast(BusinessEvents.TRANSLATION_UPDATE, data, {
      rooms: [buildArticleRoomName(data.refId)],
    })
  }

  // --- Helpers ---

  private async broadcastWithTranslation(
    event: BusinessEvents,
    doc: PostModel | NoteModel | PageModel,
    roomName: string,
  ) {
    const sockets = await this.webGateway.getSocketsOfRoom(roomName)
    if (!sockets.length) return

    const articleId = (doc as any).id || (doc as any)._id?.toString()
    const originalData = {
      title: (doc as any).title,
      text: (doc as any).text,
      summary: (doc as any).summary,
      tags: (doc as any).tags,
    }

    // Group sockets by lang
    const langGroups = new Map<string | undefined, string[]>()
    await Promise.all(
      sockets.map(async (socket) => {
        const meta = await this.gatewayService.getSocketMetadata(socket)
        const lang = meta?.lang
        const ids = langGroups.get(lang) || []
        ids.push(socket.id)
        langGroups.set(lang, ids)
      }),
    )

    for (const [lang, socketIds] of langGroups) {
      const result = await this.translationService.translateArticle({
        articleId,
        targetLang: lang,
        originalData,
      })

      const data = {
        ...doc,
        title: result.title,
        text: result.text,
        summary: result.summary,
        tags: result.tags,
        isTranslated: result.isTranslated,
        translationMeta: result.translationMeta,
        availableTranslations: result.availableTranslations,
      }

      // socket ID 即 socket.io 自动加入的 room，可直接定向
      this.webGateway.broadcast(event, data, { rooms: socketIds })
    }
  }
}
