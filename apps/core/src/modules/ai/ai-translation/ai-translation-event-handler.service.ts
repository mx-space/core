import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'

import { AiTranslationService } from './ai-translation.service'
import type { ArticleEventPayload } from './ai-translation.types'
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

@Injectable()
export class AiTranslationEventHandlerService {
  constructor(
    private readonly aiTranslationService: AiTranslationService,
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

  @OnEvent(BusinessEvents.CATEGORY_UPDATE)
  async handleCategoryUpdate(event: CategoryEventPayload) {
    if (!event.id || !event.name) return
    await this.translationEntryService.handleEntityUpdate(
      'category.name',
      event.id,
      event.name,
    )
  }

  @OnEvent(BusinessEvents.CATEGORY_DELETE)
  async handleCategoryDelete(event: { id: string }) {
    if (!event.id) return
    await this.translationEntryService.deleteByKeyPath(
      'category.name',
      event.id,
    )
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
}
