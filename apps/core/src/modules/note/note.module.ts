import { forwardRef, Module } from '@nestjs/common'

import { NOTE_SERVICE_TOKEN } from '~/constants/injection.constant'
import { GatewayModule } from '~/processors/gateway/gateway.module'

import { AiModule } from '../ai/ai.module'
import { CommentModule } from '../comment/comment.module'
import { ContentMigrationCommitService } from '../content-migration/content-migration-commit.service'
import { DraftModule } from '../draft/draft.module'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { TopicModule } from '../topic/topic.module'
import { NoteController } from './note.controller'
import { NoteRepository } from './note.repository'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [
    NoteService,
    NoteRepository,
    ContentMigrationCommitService,
    { provide: NOTE_SERVICE_TOKEN, useExisting: NoteService },
  ],
  exports: [NoteService, NoteRepository, NOTE_SERVICE_TOKEN],
  imports: [
    GatewayModule,
    forwardRef(() => AiModule),
    DraftModule,
    EnrichmentModule,
    SlugTrackerModule,
    forwardRef(() => CommentModule),
    forwardRef(() => TopicModule),
  ],
})
export class NoteModule {}
