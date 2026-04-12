import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { InjectModel } from '~/transformers/model.transformer'

import { ConfigsService } from '../../configs/configs.service'
import { resolveTargetLanguages } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITranslationModel } from './ai-translation.model'
import { AiTranslationService } from './ai-translation.service'
import type {
  ArticleDocument,
  ArticleEventPayload,
  CategoryTranslationEventPayload,
  EntityDeleteEventPayload,
  TopicTranslationEventPayload,
} from './ai-translation.types'
import { TranslationEntryService } from './translation-entry.service'

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
    private readonly translationEntryService: TranslationEntryService,
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

    const targetLanguages = resolveTargetLanguages(
      undefined,
      aiConfig.translationTargetLanguages,
    )
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

    const targetLanguages = resolveTargetLanguages(
      undefined,
      aiConfig.translationTargetLanguages,
    )
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

  // === Translation Entry: Category ===

  @OnEvent(BusinessEvents.CATEGORY_CREATE)
  async handleCategoryCreate(event: CategoryTranslationEventPayload) {
    if (!(await this.isAutoEntryEnabled())) return
    if (!event.name) return
    const id = event.id
    this.logger.log(`Auto-generating translation entry for category: ${id}`)
    await this.translationEntryService
      .generateForValues([
        {
          keyPath: 'category.name',
          keyType: 'entity',
          lookupKey: id,
          sourceText: event.name,
        },
      ])
      .catch((err) =>
        this.logger.error(`Category entry generation failed: ${err.message}`),
      )
  }

  @OnEvent(BusinessEvents.CATEGORY_UPDATE)
  async handleCategoryUpdate(event: CategoryTranslationEventPayload) {
    if (!event.name) return
    const id = event.id
    await this.translationEntryService.handleEntityUpdate(
      'category.name',
      id,
      event.name,
    )

    if (!(await this.isAutoEntryEnabled())) return
    await this.translationEntryService
      .generateForValues([
        {
          keyPath: 'category.name',
          keyType: 'entity',
          lookupKey: id,
          sourceText: event.name,
        },
      ])
      .catch((err) =>
        this.logger.error(
          `Category entry re-generation failed: ${err.message}`,
        ),
      )
  }

  @OnEvent(BusinessEvents.CATEGORY_DELETE)
  async handleCategoryDelete(event: EntityDeleteEventPayload) {
    await this.translationEntryService.deleteByKeyPath(
      'category.name',
      event.id,
    )
  }

  // === Translation Entry: Topic ===

  @OnEvent(BusinessEvents.TOPIC_CREATE)
  async handleTopicCreate(event: TopicTranslationEventPayload) {
    if (!(await this.isAutoEntryEnabled())) return
    const id = event.id
    const values: Parameters<TranslationEntryService['generateForValues']>[0] =
      []
    if (event.name) {
      values.push({
        keyPath: 'topic.name',
        keyType: 'entity',
        lookupKey: id,
        sourceText: event.name,
      })
    }
    if (event.introduce) {
      values.push({
        keyPath: 'topic.introduce',
        keyType: 'entity',
        lookupKey: id,
        sourceText: event.introduce,
      })
    }
    if (!values.length) return
    this.logger.log(`Auto-generating translation entries for topic: ${id}`)
    await this.translationEntryService
      .generateForValues(values)
      .catch((err) =>
        this.logger.error(`Topic entry generation failed: ${err.message}`),
      )
  }

  @OnEvent(BusinessEvents.TOPIC_UPDATE)
  async handleTopicUpdate(event: TopicTranslationEventPayload) {
    const id = event.id
    if (event.name != null) {
      await this.translationEntryService.handleEntityUpdate(
        'topic.name',
        id,
        event.name,
      )
    }
    if (event.introduce != null) {
      await this.translationEntryService.handleEntityUpdate(
        'topic.introduce',
        id,
        event.introduce,
      )
    }

    if (!(await this.isAutoEntryEnabled())) return
    const values: Parameters<TranslationEntryService['generateForValues']>[0] =
      []
    if (event.name) {
      values.push({
        keyPath: 'topic.name',
        keyType: 'entity',
        lookupKey: id,
        sourceText: event.name,
      })
    }
    if (event.introduce) {
      values.push({
        keyPath: 'topic.introduce',
        keyType: 'entity',
        lookupKey: id,
        sourceText: event.introduce,
      })
    }
    if (!values.length) return
    await this.translationEntryService
      .generateForValues(values)
      .catch((err) =>
        this.logger.error(`Topic entry re-generation failed: ${err.message}`),
      )
  }

  @OnEvent(BusinessEvents.TOPIC_DELETE)
  async handleTopicDelete(event: EntityDeleteEventPayload) {
    await this.translationEntryService.deleteByKeyPath('topic.name', event.id)
    await this.translationEntryService.deleteByKeyPath(
      'topic.introduce',
      event.id,
    )
  }

  // === Translation Entry: Note mood/weather ===

  @OnEvent(BusinessEvents.NOTE_CREATE)
  async handleNoteCreateEntry(event: { id: string }) {
    if (!(await this.isAutoEntryEnabled())) return
    const note = await this.databaseService.findGlobalById(event.id)
    if (!note) return
    const values = this.collectNoteDictValues(note.document)
    if (!values.length) return
    await this.translationEntryService
      .generateForValues(values)
      .catch((err) =>
        this.logger.error(`Note entry generation failed: ${err.message}`),
      )
  }

  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleNoteUpdateEntry(event: { id: string }) {
    if (!(await this.isAutoEntryEnabled())) return
    const note = await this.databaseService.findGlobalById(event.id)
    if (!note) return
    const values = this.collectNoteDictValues(note.document)
    if (!values.length) return
    await this.translationEntryService
      .generateForValues(values)
      .catch((err) =>
        this.logger.error(`Note entry generation failed: ${err.message}`),
      )
  }

  // === Helpers ===

  private async isAutoEntryEnabled(): Promise<boolean> {
    const aiConfig = await this.configService.get('ai')
    return Boolean(
      aiConfig.enableAutoGenerateTranslation && aiConfig.enableTranslation,
    )
  }

  private collectNoteDictValues(
    doc: any,
  ): Parameters<TranslationEntryService['generateForValues']>[0] {
    const values: Parameters<TranslationEntryService['generateForValues']>[0] =
      []
    if (doc?.mood && typeof doc.mood === 'string') {
      values.push({
        keyPath: 'note.mood',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(doc.mood),
        sourceText: doc.mood,
      })
    }
    if (doc?.weather && typeof doc.weather === 'string') {
      values.push({
        keyPath: 'note.weather',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(doc.weather),
        sourceText: doc.weather,
      })
    }
    return values
  }
}
