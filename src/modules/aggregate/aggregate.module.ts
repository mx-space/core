import { Module, forwardRef } from '@nestjs/common'
import { AnalyzeModule } from '../analyze/analyze.module'
import { CategoryModule } from '../category/category.module'
import { CommentModule } from '../comment/comment.module'
import { LinkModule } from '../link/link.module'
import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { RecentlyModule } from '../recently/recently.module'
import { SayModule } from '../say/say.module'
import { AggregateController } from './aggregate.controller'
import { AggregateService } from './aggregate.service'
import { GatewayModule } from '~/processors/gateway/gateway.module'

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

    AnalyzeModule,
    GatewayModule,
  ],
  providers: [AggregateService],
  exports: [AggregateService],
  controllers: [AggregateController],
})
export class AggregateModule {}
