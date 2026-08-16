import { forwardRef, Global, Module } from '@nestjs/common'

import { CommentModule } from '../comment/comment.module'
import { PollModule } from '../poll/poll.module'
import { ReviewDemoService } from './review-demo.service'

@Global()
@Module({
  exports: [ReviewDemoService],
  imports: [forwardRef(() => CommentModule), PollModule],
  providers: [ReviewDemoService],
})
export class ReviewDemoModule {}
