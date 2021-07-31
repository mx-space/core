import { forwardRef, Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  controllers: [PostController],
  providers: [PostService],
  imports: [forwardRef(() => CategoryModule)],
  exports: [PostService],
})
export class PostModule {}
