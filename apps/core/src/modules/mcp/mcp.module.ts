import { Module } from '@nestjs/common'

import { NoteModule } from '../note/note.module'
import { PostModule } from '../post/post.module'
import { McpService } from './mcp.service'

@Module({
  imports: [NoteModule, PostModule],
  providers: [McpService],

  exports: [McpService],
})
export class McpModule {}
