import { Global, Module } from '@nestjs/common'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { DraftModule } from '../draft/draft.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Global()
@Module({
  imports: [SlugTrackerModule, DraftModule],
  controllers: [PostController],
  providers: [
    PostService,
    { provide: POST_SERVICE_TOKEN, useExisting: PostService },
  ],
  exports: [PostService, POST_SERVICE_TOKEN],
})
export class PostModule {}
