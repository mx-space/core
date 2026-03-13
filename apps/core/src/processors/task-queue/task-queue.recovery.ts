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
  private static readonly REDIS_WARN_INTERVAL_MS = 30_000
  private readonly logger = new Logger(TaskQueueRecovery.name)
  private intervalId: NodeJS.Timeout | null = null
  private lastRedisUnavailableWarnAt = 0

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
      if (!this.taskService.isRedisReady()) {
        this.warnRedisUnavailable('Task recovery waiting for Redis connection')
        return
      }

      const recovered = await this.taskService.recoverStaleTasks()
      if (recovered > 0) {
        this.logger.log(`Recovered ${recovered} stale tasks`)
      }
    } catch (error) {
      if (this.taskService.isRedisUnavailableError(error)) {
        this.warnRedisUnavailable('Task recovery waiting for Redis connection')
      } else {
        this.logger.error(`Recovery error: ${error.message}`, error.stack)
      }
    }
  }

  private warnRedisUnavailable(message: string) {
    const now = Date.now()
    if (
      now - this.lastRedisUnavailableWarnAt <
      TaskQueueRecovery.REDIS_WARN_INTERVAL_MS
    ) {
      return
    }

    this.lastRedisUnavailableWarnAt = now
    this.logger.warn(
      JSON.stringify({
        module: TaskQueueRecovery.name,
        message,
        redisStatus: this.taskService.getRedisStatus(),
      }),
    )
  }
}
