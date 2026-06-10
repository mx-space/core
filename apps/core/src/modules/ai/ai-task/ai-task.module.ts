import { Module } from '@nestjs/common'

import { AiTaskService } from './ai-task.service'

@Module({
  providers: [AiTaskService],
  exports: [AiTaskService],
})
export class AiTaskModule {}
