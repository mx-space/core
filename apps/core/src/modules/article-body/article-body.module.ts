import { Module } from '@nestjs/common'

import { MembershipModule } from '../membership/membership.module'
import { NoteModule } from '../note/note.module'
import { PostModule } from '../post/post.module'
import { ArticleBodyController } from './article-body.controller'
import { ArticleBodyService } from './article-body.service'

@Module({
  imports: [PostModule, NoteModule, MembershipModule],
  controllers: [ArticleBodyController],
  providers: [ArticleBodyService],
})
export class ArticleBodyModule {}
