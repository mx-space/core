import { forwardRef, Global, Module } from '@nestjs/common'

import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'

import { AiModule } from '../ai/ai.module'
import { CommentModule } from '../comment/comment.module'
import { DraftModule } from '../draft/draft.module'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { MembershipModule } from '../membership/membership.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { SnippetModule } from '../snippet/snippet.module'
import { PostController } from './post.controller'
import { PostRepository } from './post.repository'
import { PostService } from './post.service'

@Global()
@Module({
  imports: [
    SlugTrackerModule,
    DraftModule,
    AiModule,
    EnrichmentModule,
    SnippetModule,
    MembershipModule,
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
