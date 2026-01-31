import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { TASK_QUEUE_LIMITS } from './task-queue.constants'
import { TaskQueueService } from './task-queue.service'

@Injectable()
export class TaskQueueRecovery implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueRecovery.name)
  private intervalId: NodeJS.Timeout | null = null

  constructor(private readonly taskService: TaskQueueService) {}

  onModuleInit() {
    this.start()
  }

  onModuleDestroy() {
    this.stop()
  }

  start() {
    if (this.intervalId) return

    this.logger.log('Task recovery service started')

    this.intervalId = setInterval(
      () => this.recover(),
      TASK_QUEUE_LIMITS.recoveryIntervalMs,
    )

    this.recover()
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.logger.log('Task recovery service stopped')
  }

  private async recover() {
    try {
      const recovered = await this.taskService.recoverStaleTasks()
      if (recovered > 0) {
        this.logger.log(`Recovered ${recovered} stale tasks`)
      }
    } catch (error) {
      this.logger.error(`Recovery error: ${error.message}`, error.stack)
    }
  }
}
