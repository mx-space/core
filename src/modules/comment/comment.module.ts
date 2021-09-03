import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { CommentService } from './comment.service'

@Module({
  controllers: [],
  providers: [CommentService],
  exports: [CommentService],
  imports: [UserModule],
})
export class CommentModule {}
