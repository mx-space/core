import { forwardRef, Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { CommentModule } from '../comment/comment.module'
import { TopicModule } from '../topic/topic.module'
import { NoteController } from './note.controller'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService],
  imports: [
    GatewayModule,
    forwardRef(() => CommentModule),

    forwardRef(() => TopicModule),
  ],
})
export class NoteModule {}
