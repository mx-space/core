import { forwardRef, Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { AiModule } from '../ai/ai.module'
import { CommentModule } from '../comment/comment.module'
import { DraftModule } from '../draft/draft.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { TopicModule } from '../topic/topic.module'
import { NoteController } from './note.controller'
import { NoteRepository } from './note.repository'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [NoteService, NoteRepository],
  exports: [NoteService, NoteRepository],
  imports: [
    GatewayModule,
    AiModule,
    DraftModule,
    SlugTrackerModule,
    forwardRef(() => CommentModule),
    forwardRef(() => TopicModule),
  ],
})
export class NoteModule {}
