import { forwardRef, Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { DraftModule } from '../draft/draft.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  imports: [forwardRef(() => CategoryModule), SlugTrackerModule, DraftModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
