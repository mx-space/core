import { Global, Module } from '@nestjs/common'

import { TaskQueueEmitter } from './task-queue.emitter'
import { TaskQueueProcessor } from './task-queue.processor'
import { TaskQueueRecovery } from './task-queue.recovery'
import { RoomSubsService } from './task-queue.room-subs.service'
import { TaskQueueService } from './task-queue.service'

@Global()
@Module({
  providers: [
    TaskQueueService,
    TaskQueueProcessor,
    TaskQueueRecovery,
    RoomSubsService,
    TaskQueueEmitter,
  ],
  exports: [
    TaskQueueService,
    TaskQueueProcessor,
    RoomSubsService,
    TaskQueueEmitter,
  ],
})
export class TaskQueueModule {}
