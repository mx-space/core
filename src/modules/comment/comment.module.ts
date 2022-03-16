import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'
import { GatewayModule } from '~/processors/gateway/gateway.module'

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
  imports: [UserModule, GatewayModule],
})
export class CommentModule {}
