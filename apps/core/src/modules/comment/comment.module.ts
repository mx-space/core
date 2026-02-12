import { forwardRef, Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { AiModule } from '../ai/ai.module'
import { OwnerModule } from '../owner/owner.module'
import { ReaderModule } from '../reader/reader.module'
import { ServerlessModule } from '../serverless/serverless.module'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
  imports: [
    OwnerModule,
    GatewayModule,
    forwardRef(() => ServerlessModule),
    forwardRef(() => ReaderModule),
    forwardRef(() => AiModule),
  ],
})
export class CommentModule {}
