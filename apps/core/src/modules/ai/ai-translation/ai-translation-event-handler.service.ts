import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'
import { DatabaseService } from '~/processors/database/database.service'

import { ConfigsService } from '../../configs/configs.service'
import { resolveTargetLanguages } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AiTranslationRepository } from './ai-translation.repository'
import { AiTranslationService } from './ai-translation.service'
import type {
  ArticleDocument,
  ArticleEventPayload,
} from './ai-translation.types'
import { TranslationEntryService } from './translation-entry.service'

interface CategoryEventPayload {
  id: string
  name?: string
}

interface TopicEventPayload {
  id: string
  name?: string
  introduce?: string
  description?: string
}

interface NoteEventPayload {
  id: string
}

interface NoteDocumentLike {
  mood?: unknown
  weather?: unknown
}

@Injectable()
export class AiTranslationEventHandlerService {
  private readonly logger = new Logger(AiTranslationEventHandlerService.name)

  constructor(
    private readonly aiTranslationService: AiTranslationService,
    private readonly configService: ConfigsService,
    private readonly databaseService: DatabaseService,
    private readonly aiTaskService: AiTaskService,
    private readonly aiTranslationRepository: AiTranslationRepository,
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

  private async resolveAutoTranslationContext(event: ArticleEventPayload) {
    const aiConfig = await this.configService.get('ai')

    if (
      !aiConfig.enableAutoGenerateTranslation ||
      !aiConfig.enableTranslation
    ) {
      return null
    }

    const id = this.aiTranslationService.extractIdFromEvent(event)
    if (!id) return null

    const article = await this.databaseService.findGlobalById(id)
    if (!article || !this.aiTranslationService.isArticleVisible(article)) {
      return null
    }

    const targetLanguages = resolveTargetLanguages(
      undefined,
      aiConfig.translationTargetLanguages,
    )
    if (!targetLanguages.length) {
      return null
    }

    return { id, article, targetLanguages }
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.PAGE_CREATE)
  async handleCreateArticle(event: ArticleEventPayload) {
    const context = await this.resolveAutoTranslationContext(event)
    if (!context) return
    const { id, targetLanguages } = context

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
    const context = await this.resolveAutoTranslationContext(event)
    if (!context) return
    const { id, article, targetLanguages } = context

    const existingTranslations =
      await this.aiTranslationRepository.listByRefId(id)
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
  async handleCategoryCreate(event: CategoryEventPayload) {
    if (!(await this.isAutoEntryEnabled())) return
    if (!event.id || !event.name) return
    this.logger.log(
      `Auto-generating translation entry for category: ${event.id}`,
    )
    try {
      await this.translationEntryService.generateForValues([
        {
          keyPath: 'category.name',
          keyType: 'entity',
          lookupKey: event.id,
          sourceText: event.name,
        },
      ])
    } catch (err: any) {
      this.logger.error(`Category entry generation failed: ${err.message}`)
    }
  }

  @OnEvent(BusinessEvents.CATEGORY_UPDATE)
  async handleCategoryUpdate(event: CategoryEventPayload) {
    if (!event.id || !event.name) return
    await this.translationEntryService.handleEntityUpdate(
      'category.name',
      event.id,
      event.name,
    )

    if (!(await this.isAutoEntryEnabled())) return
    try {
      await this.translationEntryService.generateForValues([
        {
          keyPath: 'category.name',
          keyType: 'entity',
          lookupKey: event.id,
          sourceText: event.name,
        },
      ])
    } catch (err: any) {
      this.logger.error(`Category entry re-generation failed: ${err.message}`)
    }
  }

  @OnEvent(BusinessEvents.CATEGORY_DELETE)
  async handleCategoryDelete(event: { id: string }) {
    if (!event.id) return
    await this.translationEntryService.deleteByKeyPath(
      'category.name',
      event.id,
    )
  }

  // === Translation Entry: Topic ===

  @OnEvent(BusinessEvents.TOPIC_CREATE)
  async handleTopicCreate(event: TopicEventPayload) {
    if (!(await this.isAutoEntryEnabled())) return
    if (!event.id) return
    const values = this.collectTopicValues(event)
    if (!values.length) return
    this.logger.log(
      `Auto-generating translation entries for topic: ${event.id}`,
    )
    try {
      await this.translationEntryService.generateForValues(values)
    } catch (err: any) {
      this.logger.error(`Topic entry generation failed: ${err.message}`)
    }
  }

  @OnEvent(BusinessEvents.TOPIC_UPDATE)
  async handleTopicUpdate(event: TopicEventPayload) {
    if (!event.id) return
    if (event.name != null) {
      await this.translationEntryService.handleEntityUpdate(
        'topic.name',
        event.id,
        event.name,
      )
    }
    if (event.introduce != null) {
      await this.translationEntryService.handleEntityUpdate(
        'topic.introduce',
        event.id,
        event.introduce,
      )
    }
    if (event.description != null) {
      await this.translationEntryService.handleEntityUpdate(
        'topic.description',
        event.id,
        event.description,
      )
    }

    if (!(await this.isAutoEntryEnabled())) return
    const values = this.collectTopicValues(event)
    if (!values.length) return
    try {
      await this.translationEntryService.generateForValues(values)
    } catch (err: any) {
      this.logger.error(`Topic entry re-generation failed: ${err.message}`)
    }
  }

  private collectTopicValues(
    event: TopicEventPayload,
  ): Parameters<TranslationEntryService['generateForValues']>[0] {
    const fields = [
      ['topic.name', event.name],
      ['topic.introduce', event.introduce],
      ['topic.description', event.description],
    ] as const
    return fields
      .filter(([, sourceText]) => !!sourceText)
      .map(([keyPath, sourceText]) => ({
        keyPath,
        keyType: 'entity',
        lookupKey: event.id,
        sourceText: sourceText!,
      }))
  }

  @OnEvent(BusinessEvents.TOPIC_DELETE)
  async handleTopicDelete(event: { id: string }) {
    if (!event.id) return
    await this.translationEntryService.deleteByKeyPath('topic.name', event.id)
    await this.translationEntryService.deleteByKeyPath(
      'topic.introduce',
      event.id,
    )
    await this.translationEntryService.deleteByKeyPath(
      'topic.description',
      event.id,
    )
  }

  // === Translation Entry: Note mood/weather ===

  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleNoteEntry(event: NoteEventPayload) {
    if (!(await this.isAutoEntryEnabled())) return
    if (!event.id) return
    const note = await this.databaseService.findGlobalById(event.id)
    if (!note) return
    const values = this.collectNoteDictValues(note.document)
    if (!values.length) return
    try {
      await this.translationEntryService.generateForValues(values)
    } catch (err: any) {
      this.logger.error(`Note entry generation failed: ${err.message}`)
    }
  }

  // === Helpers ===

  private async isAutoEntryEnabled(): Promise<boolean> {
    const aiConfig = await this.configService.get('ai')
    return Boolean(
      aiConfig.enableAutoGenerateTranslation && aiConfig.enableTranslation,
    )
  }

  private collectNoteDictValues(
    doc: unknown,
  ): Parameters<TranslationEntryService['generateForValues']>[0] {
    const values: Parameters<TranslationEntryService['generateForValues']>[0] =
      []
    const note = doc as NoteDocumentLike
    if (typeof note.mood === 'string') {
      values.push({
        keyPath: 'note.mood',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(note.mood),
        sourceText: note.mood,
      })
    }
    if (typeof note.weather === 'string') {
      values.push({
        keyPath: 'note.weather',
        keyType: 'dict',
        lookupKey: TranslationEntryService.hashSourceText(note.weather),
        sourceText: note.weather,
      })
    }
    return values
  }
}
