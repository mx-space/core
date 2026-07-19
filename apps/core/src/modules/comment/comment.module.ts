import { forwardRef, Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { AiModule } from '../ai/ai.module'
import { MembershipModule } from '../membership/membership.module'
import { OwnerModule } from '../owner/owner.module'
import { ReaderModule } from '../reader/reader.module'
import { ServerlessModule } from '../serverless/serverless.module'
import { CommentController } from './comment.controller'
import { CommentLifecycleService } from './comment.lifecycle.service'
import { CommentRepository } from './comment.repository'
import { CommentService } from './comment.service'
import { CommentSpamFilterService } from './comment.spam-filter'
import { CommentAnchorService } from './comment-anchor.service'
import { CommentCountryService } from './comment-country.service'
import { CommentReaderFillService } from './comment-reader-fill.service'

@Module({
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    CommentLifecycleService,
    CommentSpamFilterService,
    CommentAnchorService,
    CommentCountryService,
    CommentReaderFillService,
  ],
  exports: [
    CommentService,
    CommentRepository,
    CommentLifecycleService,
    CommentSpamFilterService,
    CommentAnchorService,
    CommentCountryService,
    CommentReaderFillService,
  ],
  imports: [
    OwnerModule,
    GatewayModule,
    MembershipModule,
    forwardRef(() => ServerlessModule),
    forwardRef(() => ReaderModule),
    forwardRef(() => AiModule),
  ],
})
export class CommentModule {}
