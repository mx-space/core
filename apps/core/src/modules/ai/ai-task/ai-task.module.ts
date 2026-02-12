import { Module } from '@nestjs/common'
import { AiTaskController } from './ai-task.controller'
import { AiTaskService } from './ai-task.service'

@Module({
  providers: [AiTaskService],
  controllers: [AiTaskController],
  exports: [AiTaskService],
})
export class AiTaskModule {}
