import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'

import { AiTaskService } from '../../ai-task/ai-task.service'

interface PageEventPayload {
  id: string
}

@Injectable()
export class PageEmbeddingEventsListener {
  private readonly logger = new Logger(PageEmbeddingEventsListener.name)

  constructor(private readonly aiTaskService: AiTaskService) {}

  @OnEvent(BusinessEvents.PAGE_CREATE)
  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handleUpsert(event: PageEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'upsert')
  }

  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDelete(event: PageEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'delete')
  }

  private async enqueue(id: string, op: 'upsert' | 'delete') {
    try {
      await this.aiTaskService.createEmbedSyncTask({
        sourceType: 'page',
        sourceId: id,
        op,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue page embed sync: id=${id} op=${op} error=${(error as Error)?.message}`,
      )
    }
  }
}
