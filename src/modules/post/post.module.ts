import { Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  imports: [CategoryModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
