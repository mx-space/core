import { forwardRef, Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { PostController } from './post.controller'
import { PostResolver } from './post.resolver'
import { PostService } from './post.service'

@Module({
  imports: [forwardRef(() => CategoryModule)],
  controllers: [PostController],
  providers: [PostService, PostResolver],
  exports: [PostService],
})
export class PostModule {}
