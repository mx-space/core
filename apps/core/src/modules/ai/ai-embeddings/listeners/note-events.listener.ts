import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'

import { AiTaskService } from '../../ai-task/ai-task.service'

interface NoteEventPayload {
  id: string
}

@Injectable()
export class NoteEmbeddingEventsListener {
  private readonly logger = new Logger(NoteEmbeddingEventsListener.name)

  constructor(private readonly aiTaskService: AiTaskService) {}

  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleUpsert(event: NoteEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'upsert')
  }

  @OnEvent(BusinessEvents.NOTE_DELETE)
  async handleDelete(event: NoteEventPayload) {
    if (!event?.id) return
    await this.enqueue(event.id, 'delete')
  }

  private async enqueue(id: string, op: 'upsert' | 'delete') {
    try {
      await this.aiTaskService.createEmbedSyncTask({
        sourceType: 'note',
        sourceId: id,
        op,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue note embed sync: id=${id} op=${op} error=${(error as Error)?.message}`,
      )
    }
  }
}
