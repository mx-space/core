import { Module } from '@nestjs/common'

import { AggregateModule } from '../aggregate/aggregate.module'
import { MarkdownModule } from '../markdown/markdown.module'
import { FeedController } from './feed.controller'

@Module({
  controllers: [FeedController],
  providers: [],
  imports: [AggregateModule, MarkdownModule],
})
export class FeedModule {}
