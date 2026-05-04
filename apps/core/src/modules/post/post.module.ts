import { forwardRef, Global, Module } from '@nestjs/common'

import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'

import { AiModule } from '../ai/ai.module'
import { CommentModule } from '../comment/comment.module'
import { DraftModule } from '../draft/draft.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { PostController } from './post.controller'
import { PostRepository } from './post.repository'
import { PostService } from './post.service'

@Global()
@Module({
  imports: [
    SlugTrackerModule,
    DraftModule,
    AiModule,
    forwardRef(() => CommentModule),
  ],
  controllers: [PostController],
  providers: [
    PostRepository,
    PostService,
    { provide: POST_SERVICE_TOKEN, useExisting: PostService },
  ],
  exports: [PostService, PostRepository, POST_SERVICE_TOKEN],
})
export class PostModule {}
