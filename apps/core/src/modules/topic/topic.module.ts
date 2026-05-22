import { forwardRef, Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { TopicBaseController } from './topic.controller'
import { TopicRepository } from './topic.repository'

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [TopicBaseController],
  providers: [TopicRepository],
  exports: [TopicRepository],
})
export class TopicModule {}
