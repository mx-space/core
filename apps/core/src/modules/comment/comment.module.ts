import { forwardRef, Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { AiModule } from '../ai/ai.module'
import { ReaderModule } from '../reader/reader.module'
import { ServerlessModule } from '../serverless/serverless.module'
import { UserModule } from '../user/user.module'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
  imports: [
    UserModule,
    GatewayModule,
    forwardRef(() => ServerlessModule),
    forwardRef(() => ReaderModule),
    forwardRef(() => AiModule),
  ],
})
export class CommentModule {}
