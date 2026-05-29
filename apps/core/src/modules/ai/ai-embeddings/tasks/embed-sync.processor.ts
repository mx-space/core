import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { TaskQueueProcessor } from '~/processors/task-queue'

import {
  AITaskType,
  type EmbedSyncTaskPayload,
} from '../../ai-task/ai-task.types'
import { AiEmbeddingsService } from '../ai-embeddings.service'

@Injectable()
export class EmbedSyncTaskProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmbedSyncTaskProcessor.name)

  constructor(
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly embeddingsService: AiEmbeddingsService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler<EmbedSyncTaskPayload>({
      type: AITaskType.EmbedSync,
      execute: async (payload, context) => {
        await context.appendLog(
          'info',
          `embed sync ${payload.sourceType}:${payload.sourceId} op=${payload.op}`,
        )
        const result = await this.embeddingsService.syncSource(
          payload.sourceType,
          payload.sourceId,
          payload.op,
        )
        await context.setResult(result)
      },
    })
    this.logger.log('Embed sync task handler registered')
  }
}
