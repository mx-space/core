import { Module, forwardRef } from '@nestjs/common'

import { PostModule } from '../post/post.module'
import { CategoryController } from './category.controller'
import { CategoryService } from './category.service'

@Module({
  providers: [CategoryService],
  exports: [CategoryService],
  controllers: [CategoryController],
  imports: [forwardRef(() => PostModule)],
})
export class CategoryModule {}
