import { forwardRef, Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { AnalyzeModule } from '../analyze/analyze.module'
import { CategoryModule } from '../category/category.module'
import { CommentModule } from '../comment/comment.module'
import { LinkModule } from '../link/link.module'
import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { RecentlyModule } from '../recently/recently.module'
import { SayModule } from '../say/say.module'
import { SnippetModule } from '../snippet/snippet.module'
import { AggregateController } from './aggregate.controller'
import { AggregateService } from './aggregate.service'

@Module({
  imports: [
    forwardRef(() => CategoryModule),
    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
    forwardRef(() => PageModule),
    forwardRef(() => SayModule),
    forwardRef(() => CommentModule),
    forwardRef(() => LinkModule),
    forwardRef(() => RecentlyModule),
    forwardRef(() => SnippetModule),

    AnalyzeModule,
    GatewayModule,
  ],
  providers: [AggregateService],
  exports: [AggregateService],
  controllers: [AggregateController],
})
export class AggregateModule {}
