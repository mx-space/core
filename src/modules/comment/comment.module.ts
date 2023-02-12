import { Module, forwardRef } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { ServerlessModule } from '../serverless/serverless.module'
import { UserModule } from '../user/user.module'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
  imports: [UserModule, GatewayModule, forwardRef(() => ServerlessModule)],
})
export class CommentModule {}
