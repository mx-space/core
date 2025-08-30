import { Module } from '@nestjs/common'
import { TopicBaseController } from './topic.controller'
import { TopicService } from './topic.service'

@Module({
  controllers: [TopicBaseController],
  exports: [TopicService],
  providers: [TopicService],
})
export class TopicModule {}
