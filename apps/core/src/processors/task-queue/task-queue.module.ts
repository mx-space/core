import { Global, Module } from '@nestjs/common'
import { TaskQueueProcessor } from './task-queue.processor'
import { TaskQueueRecovery } from './task-queue.recovery'
import { TaskQueueService } from './task-queue.service'

@Global()
@Module({
  providers: [TaskQueueService, TaskQueueProcessor, TaskQueueRecovery],
  exports: [TaskQueueService, TaskQueueProcessor],
})
export class TaskQueueModule {}
