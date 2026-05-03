import { Module } from '@nestjs/common'

import { CategoryModule } from '../category/category.module'
import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { MarkdownController } from './markdown.controller'
import { MarkdownService } from './markdown.service'

@Module({
  imports: [CategoryModule, PostModule, NoteModule, PageModule],
  controllers: [MarkdownController],
  providers: [MarkdownService],
  exports: [MarkdownService],
})
export class MarkdownModule {}
