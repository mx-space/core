import { forwardRef, Module } from '@nestjs/common'
import { PostModule } from '../post/post.module'
import { CategoryService } from './category.service'

@Module({
  imports: [forwardRef(() => PostModule)],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
