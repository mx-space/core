import { Module, forwardRef } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { CommentModule } from '../comment/comment.module'
import { NoteController } from './note.controller'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService],
  imports: [GatewayModule, forwardRef(() => CommentModule)],
})
export class NoteModule {}
