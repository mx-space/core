import { forwardRef, Module } from '@nestjs/common'

import { CategoryModule } from '../category/category.module'
import { CommentModule } from '../comment/comment.module'
import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { RecentlyModule } from '../recently/recently.module'
import { SayModule } from '../say/say.module'
import { McpController } from './mcp.controller'
import { McpService } from './mcp.service'

@Module({
  imports: [
    forwardRef(() => NoteModule),
    forwardRef(() => PostModule),
    forwardRef(() => CategoryModule),
    forwardRef(() => PageModule),
    forwardRef(() => SayModule),
    forwardRef(() => RecentlyModule),
    forwardRef(() => CommentModule),
  ],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
