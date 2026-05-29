import { forwardRef, Module } from '@nestjs/common'

import { AiModule } from '../ai.module'
import { AiTaskModule } from '../ai-task/ai-task.module'
import { AiEmbeddingsController } from './ai-embeddings.controller'
import { AiEmbeddingsRepository } from './ai-embeddings.repository'
import { AiEmbeddingsService } from './ai-embeddings.service'
import { NoteEmbeddingEventsListener } from './listeners/note-events.listener'
import { PageEmbeddingEventsListener } from './listeners/page-events.listener'
import { PostEmbeddingEventsListener } from './listeners/post-events.listener'
import { EmbedSyncTaskProcessor } from './tasks/embed-sync.processor'

@Module({
  imports: [AiTaskModule, forwardRef(() => AiModule)],
  controllers: [AiEmbeddingsController],
  providers: [
    AiEmbeddingsRepository,
    AiEmbeddingsService,
    EmbedSyncTaskProcessor,
    NoteEmbeddingEventsListener,
    PageEmbeddingEventsListener,
    PostEmbeddingEventsListener,
  ],
  exports: [AiEmbeddingsService, AiEmbeddingsRepository],
})
export class AiEmbeddingsModule {}
