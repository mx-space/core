import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { AsyncQueue } from '~/utils/queue.util'
import { scheduleManager } from '~/utils/schedule.util'
import { md5 } from '~/utils/tool.util'
import { generateText, Output } from 'ai'
import dayjs from 'dayjs'
import removeMdCodeblock from 'remove-md-codeblock'
import { z } from 'zod'
import { ConfigsService } from '../../configs/configs.service'
import type { NoteModel } from '../../note/note.model'
import type { PostModel } from '../../post/post.model'
import { AI_TASK_LOCK_TTL } from '../ai.constants'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { AITranslationModel } from './ai-translation.model'
import type { GetTranslationsGroupedQueryInput } from './ai-translation.schema'

interface ArticleContent {
  title: string
  text: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
}

type ArticleDocument = PostModel | NoteModel

type ArticleEventDocument = ArticleDocument & {
  _id?: { toString?: () => string } | string
}

type ArticleEventPayload = ArticleEventDocument | { data: string }

type GlobalArticle =
  | { document: PostModel; type: CollectionRefTypes.Post }
  | { document: NoteModel; type: CollectionRefTypes.Note }
  | {
      document: unknown
      type: CollectionRefTypes.Page | CollectionRefTypes.Recently
    }

@Injectable()
export class AiTranslationService {
  private readonly logger = new Logger(AiTranslationService.name)
  private cachedTaskId2Promise = new Map<string, Promise<AITranslationModel>>()

  constructor(
    @InjectModel(AITranslationModel)
    private readonly aiTranslationModel: MongooseModel<AITranslationModel>,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly redisService: RedisService,
    private readonly aiService: AiService,
    private readonly eventManager: EventManagerService,
  ) {}

  private extractIdFromEvent(event: ArticleEventPayload): string | null {
    if ('data' in event) {
      return event.data ?? null
    }
    if (event._id && typeof event._id === 'string') {
      return event._id
    }
    return event.id ?? event._id?.toString?.() ?? null
  }

  private getMetaLang(document: {
    meta?: { lang?: string }
  }): string | undefined {
    return document.meta?.lang
  }

  private toArticleContent(document: ArticleDocument): ArticleContent {
    return {
      title: document.title,
      text: document.text,
      summary:
        'summary' in document ? (document.summary ?? undefined) : undefined,
      tags: 'tags' in document ? document.tags : undefined,
    }
  }

  private isPostArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Post; document: PostModel } {
    return article.type === CollectionRefTypes.Post
  }

  private isNoteArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Note; document: NoteModel } {
    return article.type === CollectionRefTypes.Note
  }

  private isArticleVisible(article: GlobalArticle): boolean {
    if (this.isPostArticle(article)) {
      return article.document.isPublished !== false
    }

    if (this.isNoteArticle(article)) {
      const document = article.document
      if (document.isPublished === false) return false
      if (document.password) return false
      if (document.publicAt && dayjs(document.publicAt).isAfter(new Date())) {
        return false
      }
      return true
    }

    return false
  }

  private computeContentHash(
    document: ArticleContent,
    sourceLang: string,
  ): string {
    return md5(
      JSON.stringify({
        title: document.title,
        text: document.text,
        summary: document.summary,
        tags: document.tags,
        sourceLang,
      }),
    )
  }

  private serializeText(text: string): string {
    return removeMdCodeblock(text)
  }

  private async translateContent(
    content: ArticleContent,
    targetLang: string,
  ): Promise<{
    sourceLang: string
    title: string
    text: string
    summary: string | null
    tags: string[] | null
  }> {
    const model = await this.aiService.getTranslationModel()

    const { output } = await generateText({
      model: model as Parameters<typeof generateText>[0]['model'],
      output: Output.object({
        schema: z.object({
          sourceLang: z
            .string()
            .describe(AI_PROMPTS.translation.schema.sourceLang),
          title: z.string().describe(AI_PROMPTS.translation.schema.title),
          text: z.string().describe(AI_PROMPTS.translation.schema.text),
          summary: z
            .string()
            .nullable()
            .describe(AI_PROMPTS.translation.schema.summary),
          tags: z
            .array(z.string())
            .nullable()
            .describe(AI_PROMPTS.translation.schema.tags),
        }),
      }),
      prompt: AI_PROMPTS.translation.getTranslationPrompt(targetLang, {
        title: content.title,
        text: this.serializeText(content.text),
        summary: content.summary ?? undefined,
        tags: content.tags,
      }),
      temperature: 0.3,
      maxRetries: 2,
    })

    return output!
  }

  async generateTranslation(
    articleId: string,
    targetLang: string,
  ): Promise<AITranslationModel> {
    const startedAt = Date.now()
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableTranslation) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    if (
      article.type === CollectionRefTypes.Recently ||
      article.type === CollectionRefTypes.Page
    ) {
      throw new BizException(ErrorCodeEnum.ContentNotFoundCantProcess)
    }

    const document = article.document as ArticleDocument

    this.logger.log(
      `AI translation start: article=${articleId} target=${targetLang}`,
    )

    const taskId = `ai:translation:${articleId}:${targetLang}`
    const redis = this.redisService.getClient()

    try {
      if (this.cachedTaskId2Promise.has(taskId)) {
        this.logger.log(
          `AI translation dedupe: article=${articleId} target=${targetLang}`,
        )
        return this.cachedTaskId2Promise.get(taskId)!
      }

      const isProcessing = await redis.get(taskId)
      if (isProcessing === 'processing') {
        this.logger.warn(
          `AI translation locked: article=${articleId} target=${targetLang}`,
        )
        throw new BizException(ErrorCodeEnum.AIProcessing)
      }

      const taskPromise = this.executeTranslation(
        articleId,
        article.type,
        document,
        targetLang,
        taskId,
        redis,
      )

      this.cachedTaskId2Promise.set(taskId, taskPromise)
      const result = await taskPromise
      this.logger.log(
        `AI translation done: article=${articleId} target=${targetLang} ms=${
          Date.now() - startedAt
        }`,
      )
      return result
    } catch (error) {
      if (error instanceof BizException) {
        throw error
      }
      this.logger.error(
        `AI translation failed for article ${articleId}: ${error.message}`,
        error.stack,
      )
      throw new BizException(ErrorCodeEnum.AIException, error.message)
    } finally {
      this.cachedTaskId2Promise.delete(taskId)
      await redis.del(taskId)
    }
  }

  private async executeTranslation(
    articleId: string,
    refType: CollectionRefTypes,
    document: ArticleDocument,
    targetLang: string,
    taskId: string,
    redis: ReturnType<RedisService['getClient']>,
  ): Promise<AITranslationModel> {
    await redis.set(taskId, 'processing', 'EX', AI_TASK_LOCK_TTL)

    const content = this.toArticleContent(document)
    const translated = await this.translateContent(content, targetLang)
    const { sourceLang } = translated
    const hash = this.computeContentHash(content, sourceLang)

    const existing = await this.aiTranslationModel.findOne({
      refId: articleId,
      refType,
      lang: targetLang,
    })

    if (existing) {
      existing.hash = hash
      existing.sourceLang = sourceLang
      existing.title = translated.title
      existing.text = translated.text
      existing.summary = translated.summary ?? undefined
      existing.tags = translated.tags ?? undefined
      await existing.save()
      this.logger.log(
        `AI translation updated: article=${articleId} target=${targetLang}`,
      )

      // 发送翻译更新事件
      this.emitTranslationEvent(BusinessEvents.TRANSLATION_UPDATE, existing)

      return existing
    }

    const created = await this.aiTranslationModel.create({
      hash,
      refId: articleId,
      refType,
      lang: targetLang,
      sourceLang,
      title: translated.title,
      text: translated.text,
      summary: translated.summary ?? undefined,
      tags: translated.tags ?? undefined,
    })
    this.logger.log(
      `AI translation created: article=${articleId} target=${targetLang}`,
    )

    // 发送翻译创建事件
    this.emitTranslationEvent(BusinessEvents.TRANSLATION_CREATE, created)

    return created
  }

  private emitTranslationEvent(
    eventType: BusinessEvents,
    translation: AITranslationModel,
  ) {
    const payload = {
      id: translation.id,
      refId: translation.refId,
      refType: translation.refType,
      lang: translation.lang,
      sourceLang: translation.sourceLang,
      title: translation.title,
      text: translation.text,
      summary: translation.summary,
      tags: translation.tags,
      hash: translation.hash,
    }

    this.eventManager.emit(eventType, payload, {
      scope: EventScope.TO_VISITOR,
    })
  }

  async generateTranslationsForLanguages(
    articleId: string,
    targetLanguages?: string[],
  ): Promise<AITranslationModel[]> {
    const aiConfig = await this.configService.get('ai')
    const languages = targetLanguages?.length
      ? targetLanguages
      : aiConfig.translationTargetLanguages || []

    if (!languages.length) {
      return []
    }

    const results: AITranslationModel[] = []
    for (const lang of languages) {
      try {
        const translation = await this.generateTranslation(articleId, lang)
        results.push(translation)
      } catch (error) {
        this.logger.error(
          `Failed to generate translation for ${articleId} to ${lang}: ${error.message}`,
        )
      }
    }

    return results
  }

  async getTranslationsByRefId(refId: string) {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

    const translations = await this.aiTranslationModel.find({ refId })
    return { translations, article }
  }

  async generateTranslationsBatch(
    refIds: string[],
    targetLanguages?: string[],
  ): Promise<{ success: string[]; failed: string[] }> {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableTranslation) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const CONCURRENCY = 5

    const { errors } = await AsyncQueue.runAll(
      refIds,
      async (refId) => {
        await this.generateTranslationsForLanguages(refId, targetLanguages)
        return refId
      },
      CONCURRENCY,
    )

    const success: string[] = []
    const failed: string[] = []

    refIds.forEach((refId, index) => {
      if (errors.has(index)) {
        this.logger.error(
          `Batch translation failed for ${refId}: ${errors.get(index)?.message}`,
        )
        failed.push(refId)
      } else {
        success.push(refId)
      }
    })

    return { success, failed }
  }

  async generateTranslationsForAll(targetLanguages?: string[]): Promise<{
    total: number
    queued: number
  }> {
    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableTranslation) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    const languages = targetLanguages?.length
      ? targetLanguages
      : aiConfig.translationTargetLanguages || []

    if (!languages.length) {
      return { total: 0, queued: 0 }
    }

    const postModel = this.databaseService.getModelByRefType(
      CollectionRefTypes.Post,
    )
    const noteModel = this.databaseService.getModelByRefType(
      CollectionRefTypes.Note,
    )

    const [posts, notes] = await Promise.all([
      postModel
        .find({ isPublished: { $ne: false } })
        .select('_id')
        .lean(),
      noteModel
        .find({
          isPublished: { $ne: false },
          password: { $in: [null, ''] },
          $or: [{ publicAt: null }, { publicAt: { $lte: new Date() } }],
        })
        .select('_id')
        .lean(),
    ])

    const allArticleIds: string[] = [
      ...posts.map((p) => p._id.toString()),
      ...notes.map((n) => n._id.toString()),
    ]

    const total = allArticleIds.length

    if (total === 0) {
      return { total: 0, queued: 0 }
    }

    const CONCURRENCY = 5

    // 在后台执行批量翻译，不阻塞请求
    scheduleManager.schedule(async () => {
      this.logger.log(
        `Batch all translation start: total=${total} concurrency=${CONCURRENCY}`,
      )

      const { errors } = await AsyncQueue.runAll(
        allArticleIds,
        async (refId) => {
          await this.generateTranslationsForLanguages(refId, languages)
          this.logger.log(`Batch all translation done: article=${refId}`)
          return refId
        },
        CONCURRENCY,
      )

      const failedCount = errors.size
      const successCount = total - failedCount

      errors.forEach((error, index) => {
        this.logger.error(
          `Batch all translation failed for ${allArticleIds[index]}: ${error.message}`,
        )
      })

      this.logger.log(
        `Batch all translation completed: success=${successCount} failed=${failedCount}`,
      )
    })

    return { total, queued: total }
  }

  async getAllTranslationsGrouped(query: GetTranslationsGroupedQueryInput) {
    const { page, size, search } = query

    // 如果有搜索关键词，先搜索文章
    let matchedRefIds: string[] | null = null
    if (search && search.trim()) {
      const keyword = search.trim()
      const postModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Post,
      )
      const noteModel = this.databaseService.getModelByRefType(
        CollectionRefTypes.Note,
      )

      const [matchedPosts, matchedNotes] = await Promise.all([
        postModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
        noteModel
          .find({ title: { $regex: keyword, $options: 'i' } })
          .select('_id')
          .lean(),
      ])

      matchedRefIds = [
        ...matchedPosts.map((p) => p._id.toString()),
        ...matchedNotes.map((n) => n._id.toString()),
      ]

      if (matchedRefIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            currentPage: page,
            totalPage: 0,
            size,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }
      }
    }

    const matchStage = matchedRefIds
      ? { $match: { refId: { $in: matchedRefIds } } }
      : null

    const pipeline: any[] = []
    if (matchStage) {
      pipeline.push(matchStage)
    }
    pipeline.push(
      {
        $group: {
          _id: '$refId',
          latestCreated: { $max: '$created' },
          translationCount: { $sum: 1 },
        },
      },
      { $sort: { latestCreated: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: (page - 1) * size }, { $limit: size }],
        },
      },
    )

    const aggregateResult = await this.aiTranslationModel.aggregate(pipeline)

    const metadata = aggregateResult[0]?.metadata[0]
    const groupedRefIds = aggregateResult[0]?.data || []
    const total = metadata?.total || 0

    if (groupedRefIds.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          currentPage: page,
          totalPage: 0,
          size,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    }

    const refIds = groupedRefIds.map((g: { _id: string }) => g._id)
    const translations = await this.aiTranslationModel
      .find({ refId: { $in: refIds } })
      .sort({ created: -1 })
      .lean()

    const articles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap = {} as Record<
      string,
      { title: string; id: string; type: CollectionRefTypes }
    >

    for (const a of articles.notes) {
      articleMap[a.id] = {
        title: a.title,
        id: a.id,
        type: CollectionRefTypes.Note,
      }
    }
    for (const a of articles.posts) {
      articleMap[a.id] = {
        title: a.title,
        id: a.id,
        type: CollectionRefTypes.Post,
      }
    }

    const translationsByRefId = translations.reduce(
      (acc, trans) => {
        if (!acc[trans.refId]) {
          acc[trans.refId] = []
        }
        acc[trans.refId].push(trans)
        return acc
      },
      {} as Record<string, AITranslationModel[]>,
    )

    const groupedData = refIds
      .map((refId: string) => {
        const article = articleMap[refId]
        if (!article) return null
        return {
          article,
          translations: translationsByRefId[refId] || [],
        }
      })
      .filter(Boolean)

    const totalPage = Math.ceil(total / size)

    return {
      data: groupedData,
      pagination: {
        total,
        currentPage: page,
        totalPage,
        size,
        hasNextPage: page < totalPage,
        hasPrevPage: page > 1,
      },
    }
  }

  async updateTranslation(
    id: string,
    data: {
      title?: string
      text?: string
      summary?: string
      tags?: string[]
    },
  ) {
    const doc = await this.aiTranslationModel.findById(id)
    if (!doc) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }

    if (data.title !== undefined) doc.title = data.title
    if (data.text !== undefined) doc.text = data.text
    if (data.summary !== undefined) doc.summary = data.summary
    if (data.tags !== undefined) doc.tags = data.tags

    await doc.save()
    return doc
  }

  async deleteTranslation(id: string) {
    const result = await this.aiTranslationModel.deleteOne({ _id: id })
    if (result.deletedCount === 0) {
      throw new BizException(ErrorCodeEnum.AITranslationNotFound)
    }
  }

  async deleteTranslationsByRefId(refId: string) {
    await this.aiTranslationModel.deleteMany({ refId })
  }

  async getTranslationForArticle(
    articleId: string,
    targetLang: string,
    options?: { ignoreVisibility?: boolean },
  ): Promise<AITranslationModel | null> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw new BizException(ErrorCodeEnum.ContentNotFound)
    }

    if (!options?.ignoreVisibility && !this.isArticleVisible(article)) {
      if (article.type === CollectionRefTypes.Post) {
        throw new BizException(ErrorCodeEnum.PostHiddenOrEncrypted)
      }
      throw new BizException(ErrorCodeEnum.NoteForbidden)
    }

    const translation = await this.aiTranslationModel.findOne({
      refId: articleId,
      lang: targetLang,
    })

    if (!translation) {
      return null
    }

    const document = article.document as ArticleDocument
    const sourceLang =
      this.getMetaLang(document) || translation.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    if (translation.hash !== currentHash) {
      return null
    }

    return translation
  }

  async getValidTranslationsForArticles(
    articles: Array<{
      id: string
      title: string
      text: string
      summary?: string | null
      tags?: string[]
      meta?: { lang?: string }
    }>,
    targetLang: string,
  ): Promise<Map<string, AITranslationModel>> {
    if (!articles.length) {
      return new Map()
    }

    const translations = await this.aiTranslationModel.find({
      refId: { $in: articles.map((article) => article.id) },
      lang: targetLang,
    })

    if (!translations.length) {
      return new Map()
    }

    const translationMap = new Map(
      translations.map((translation) => [translation.refId, translation]),
    )
    const result = new Map<string, AITranslationModel>()

    for (const article of articles) {
      const translation = translationMap.get(article.id)
      if (!translation) {
        continue
      }

      const sourceLang =
        article.meta?.lang || translation.sourceLang || 'unknown'
      const currentHash = this.computeContentHash(
        {
          title: article.title,
          text: article.text,
          summary: article.summary ?? undefined,
          tags: article.tags,
        },
        sourceLang,
      )

      if (translation.hash === currentHash) {
        result.set(article.id, translation)
      }
    }

    return result
  }

  async getAvailableLanguagesForArticle(articleId: string): Promise<string[]> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document || !this.isArticleVisible(article)) {
      return []
    }

    const document = article.document as ArticleDocument
    const translations = await this.aiTranslationModel.find({
      refId: articleId,
    })

    if (!translations.length) {
      return []
    }

    const sourceLang =
      this.getMetaLang(document) || translations[0]?.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    return translations.filter((t) => t.hash === currentHash).map((t) => t.lang)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  async handleDeleteArticle(event: ArticleEventPayload) {
    const id = this.extractIdFromEvent(event)
    if (!id) return
    await this.deleteTranslationsByRefId(id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  async handleCreateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')

    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    scheduleManager.schedule(async () => {
      try {
        this.logger.log(
          `AI auto translation start: article=${id} targets=${targetLanguages.join(
            ',',
          )}`,
        )
        await this.generateTranslationsForLanguages(id, targetLanguages)
        this.logger.log(`AI auto translation done: article=${id}`)
      } catch (error) {
        this.logger.error(
          `Auto translation failed for article ${id}: ${error.message}`,
        )
      }
    })
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleUpdateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    const existingTranslations = await this.aiTranslationModel.find({
      refId: id,
    })
    if (!existingTranslations.length) {
      scheduleManager.schedule(async () => {
        try {
          this.logger.log(
            `AI auto translation update init: article=${id} targets=${targetLanguages.join(
              ',',
            )}`,
          )
          await this.generateTranslationsForLanguages(id, targetLanguages)
          this.logger.log(`AI auto translation update init done: article=${id}`)
        } catch (error) {
          this.logger.error(
            `Auto translation update init failed for article ${id}: ${error.message}`,
          )
        }
      })
      return
    }

    const document = article.document as ArticleDocument
    const sourceLang =
      this.getMetaLang(document) ||
      existingTranslations[0]?.sourceLang ||
      'unknown'
    const newHash = this.computeContentHash(
      this.toArticleContent(document),
      sourceLang,
    )

    const outdatedLanguages = existingTranslations
      .filter((t) => t.hash !== newHash)
      .map((t) => t.lang)

    if (!outdatedLanguages.length) {
      return
    }

    scheduleManager.schedule(async () => {
      try {
        this.logger.log(
          `AI auto translation update start: article=${id} targets=${outdatedLanguages.join(
            ',',
          )}`,
        )
        await this.generateTranslationsForLanguages(id, outdatedLanguages)
        this.logger.log(`AI auto translation update done: article=${id}`)
      } catch (error) {
        this.logger.error(
          `Auto translation update failed for article ${id}: ${error.message}`,
        )
      }
    })
  }
}
