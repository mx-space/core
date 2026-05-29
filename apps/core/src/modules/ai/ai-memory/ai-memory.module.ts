import { Module } from '@nestjs/common'

import { AiService } from '../ai.service'
import { AiTaskModule } from '../ai-task/ai-task.module'
import { AiMemoryController } from './ai-memory.controller'
import { AiMemoryRepository } from './ai-memory.repository'
import { AiMemoryService } from './ai-memory.service'
import { MemoryEmbedTaskProcessor } from './tasks/memory-embed.processor'

@Module({
  imports: [AiTaskModule],
  providers: [
    AiMemoryRepository,
    AiMemoryService,
    AiService,
    MemoryEmbedTaskProcessor,
  ],
  controllers: [AiMemoryController],
  exports: [AiMemoryService],
})
export class AiMemoryModule {}
