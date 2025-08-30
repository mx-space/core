import { forwardRef, Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  imports: [forwardRef(() => CategoryModule), SlugTrackerModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
