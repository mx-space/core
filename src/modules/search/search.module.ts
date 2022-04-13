import { Module, forwardRef } from '@nestjs/common'

import { NoteModule } from '../note/note.module'
import { PostModule } from '../post/post.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
  imports: [forwardRef(() => PostModule), forwardRef(() => NoteModule)],
})
export class SearchModule {}
