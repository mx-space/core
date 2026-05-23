import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import {
  type TaskExecuteContext,
  TaskQueueProcessor,
} from '~/processors/task-queue'

import {
  AITaskType,
  type MemoryEmbedTaskPayload,
} from '../../ai-task/ai-task.types'
import { AiMemoryService } from '../ai-memory.service'

@Injectable()
export class MemoryEmbedTaskProcessor implements OnModuleInit {
  private readonly logger = new Logger(MemoryEmbedTaskProcessor.name)

  constructor(
    private readonly taskProcessor: TaskQueueProcessor,
    private readonly memoryService: AiMemoryService,
  ) {}

  onModuleInit() {
    this.taskProcessor.registerHandler<MemoryEmbedTaskPayload>({
      type: AITaskType.MemoryEmbed,
      execute: async (
        payload: MemoryEmbedTaskPayload,
        context: TaskExecuteContext,
      ) => {
        if (context.isAborted()) return
        await this.memoryService.handleEmbedTask(payload.memoryId)
      },
    })
    this.logger.log('Memory embed task handler registered')
  }
}
