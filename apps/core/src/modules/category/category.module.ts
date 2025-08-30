import { forwardRef, Module } from '@nestjs/common'
import { PostModule } from '../post/post.module'
import { SlugTrackerModule } from '../slug-tracker/slug-tracker.module'
import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Module({
  providers: [CategoryService],
  exports: [CategoryService],
  controllers: [CategoryController],
  imports: [forwardRef(() => PostModule), SlugTrackerModule],
})
export class CategoryModule {}
