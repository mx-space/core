import { Module } from '@nestjs/common'

import { TopicBaseController } from './topic.controller'
import { TopicRepository } from './topic.repository'

@Module({
  controllers: [TopicBaseController],
  providers: [TopicRepository],
  exports: [TopicRepository],
})
export class TopicModule {}
