import { forwardRef, Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { AiModule } from '../ai/ai.module'
import { OwnerModule } from '../owner/owner.module'
import { ReaderModule } from '../reader/reader.module'
import { ServerlessModule } from '../serverless/serverless.module'
import { CommentController } from './comment.controller'
import { CommentLifecycleService } from './comment.lifecycle.service'
import { CommentRepository } from './comment.repository'
import { CommentService } from './comment.service'
import { CommentSpamFilterService } from './comment.spam-filter'
import { CommentAnchorService } from './comment-anchor.service'
import { CommentReaderFillService } from './comment-reader-fill.service'

@Module({
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    CommentLifecycleService,
    CommentSpamFilterService,
    CommentAnchorService,
    CommentReaderFillService,
  ],
  exports: [
    CommentService,
    CommentRepository,
    CommentLifecycleService,
    CommentSpamFilterService,
    CommentAnchorService,
    CommentReaderFillService,
  ],
  imports: [
    OwnerModule,
    GatewayModule,
    forwardRef(() => ServerlessModule),
    forwardRef(() => ReaderModule),
    forwardRef(() => AiModule),
  ],
})
export class CommentModule {}
