import { Module } from '@nestjs/common'
import { CommentService } from './comment.service'

@Module({
  controllers: [],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
