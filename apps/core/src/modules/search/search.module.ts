import { forwardRef, Module } from '@nestjs/common'

import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { SearchController } from './search.controller'
import { SearchRepository } from './search.repository'
import { SearchService } from './search.service'

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
  exports: [SearchService],
  imports: [
    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
    forwardRef(() => PageModule),
  ],
})
export class SearchModule {}
