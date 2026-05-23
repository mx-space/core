import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'

import { AiTaskService } from '../../ai-task/ai-task.service'

interface PostEventPayload {
  id: string
}

@Injectable()
export class PostEmbeddingEventsListener {
  private readonly logger = new Logger(PostEmbeddingEventsListener.name)

  constructor(private readonly aiTaskService: AiTaskService) {}

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.POST_UPDATE)
  async handleUpsert(event: PostEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'upsert')
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  async handleDelete(event: PostEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'delete')
  }

  private async enqueue(id: string, op: 'upsert' | 'delete') {
    try {
      await this.aiTaskService.createEmbedSyncTask({
        sourceType: 'post',
        sourceId: id,
        op,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue post embed sync: id=${id} op=${op} error=${(error as Error)?.message}`,
      )
    }
  }
}
