import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'

import { ConfigsService } from '../../configs/configs.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITranslationModel } from './ai-translation.model'
import { AiTranslationService } from './ai-translation.service'
import type {
  ArticleDocument,
  ArticleEventPayload,
} from './ai-translation.types'

@Injectable()
export class AiTranslationEventHandlerService {
  private readonly logger = new Logger(AiTranslationEventHandlerService.name)

  constructor(
    private readonly aiTranslationService: AiTranslationService,
    private readonly configService: ConfigsService,
    private readonly databaseService: DatabaseService,
    private readonly aiTaskService: AiTaskService,
    @InjectModel(AITranslationModel)
    private readonly aiTranslationModel: MongooseModel<AITranslationModel>,
  ) {}

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: ArticleEventPayload) {
    const id = this.aiTranslationService.extractIdFromEvent(event)
    if (!id) return
    await this.aiTranslationService.deleteTranslationsByRefId(id)
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.PAGE_CREATE)
  async handleCreateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')

    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.aiTranslationService.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.aiTranslationService.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    await this.aiTranslationService.cancelActiveTranslationTasks(id)

    this.logger.log(
      `AI auto translation task created: article=${id} targets=${targetLanguages.join(',')}`,
    )
    await this.aiTaskService.createTranslationTask({
      refId: id,
      targetLanguages,
    })
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handleUpdateArticle(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')
    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return
    }

    const id = this.aiTranslationService.extractIdFromEvent(event)
    if (!id) return

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.aiTranslationService.isArticleVisible(article)) {
      return
    }

    const targetLanguages = aiConfig.translationTargetLanguages || []
    if (!targetLanguages.length) {
      return
    }

    const existingTranslations = await this.aiTranslationModel
      .find({ refId: id })
      .select('hash lang sourceLang')
    if (!existingTranslations.length) {
      await this.aiTranslationService.cancelActiveTranslationTasks(id)
      this.logger.log(
        `AI auto translation task created (update init): article=${id} targets=${targetLanguages.join(',')}`,
      )
      await this.aiTaskService.createTranslationTask({
        refId: id,
        targetLanguages,
      })
      return
    }

    const document = article.document as ArticleDocument
    const sourceLang =
      this.aiTranslationService.getMetaLang(document) ||
      existingTranslations[0]?.sourceLang ||
      'unknown'
    const newHash = this.aiTranslationService.computeContentHash(
      this.aiTranslationService.toArticleContent(document),
      sourceLang,
    )

    const outdatedLanguages = existingTranslations
      .filter((t) => t.hash !== newHash)
      .map((t) => t.lang)

    if (!outdatedLanguages.length) {
      return
    }

    await this.aiTranslationService.cancelActiveTranslationTasks(id)
    this.logger.log(
      `AI auto translation task created (update): article=${id} targets=${outdatedLanguages.join(',')}`,
    )
    await this.aiTaskService.createTranslationTask({
      refId: id,
      targetLanguages: outdatedLanguages,
    })
  }
}
