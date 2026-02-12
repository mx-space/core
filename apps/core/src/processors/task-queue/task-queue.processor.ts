import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { TASK_QUEUE_LIMITS, TASK_QUEUE_TTL_MS } from './task-queue.constants'
import { TaskQueueService } from './task-queue.service'
import {
  TaskStatus,
  type TaskExecuteContext,
  type TaskHandler,
} from './task-queue.types'

@Injectable()
export class TaskQueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueProcessor.name)
  private readonly workerId: string
  private isRunning = false
  private pollTimeoutId: NodeJS.Timeout | null = null
  private activeAbortControllers = new Map<string, AbortController>()
  private handlers = new Map<string, TaskHandler>()
  private activeTaskCount = 0

  constructor(private readonly taskService: TaskQueueService) {
    this.workerId = `worker-${process.pid}-${Date.now().toString(36)}`
  }

  onModuleInit() {
    this.start()
  }

  onModuleDestroy() {
    this.stop()
  }

  registerHandler<TPayload = Record<string, unknown>>(
    handler: TaskHandler<TPayload>,
  ): void {
    this.handlers.set(handler.type, handler as TaskHandler)
    this.logger.log(`Registered handler for task type: ${handler.type}`)
  }

  unregisterHandler(type: string): void {
    this.handlers.delete(type)
    this.logger.log(`Unregistered handler for task type: ${type}`)
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.logger.log(`Task processor started: workerId=${this.workerId}`)
    this.poll()
  }

  stop() {
    this.isRunning = false
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId)
      this.pollTimeoutId = null
    }

    for (const [taskId, controller] of this.activeAbortControllers) {
      controller.abort()
      this.logger.log(`Aborted task on shutdown: id=${taskId}`)
    }
    this.activeAbortControllers.clear()

    this.logger.log('Task processor stopped')
  }

  private async poll() {
    if (!this.isRunning) return

    try {
      if (this.activeTaskCount >= TASK_QUEUE_LIMITS.maxConcurrency) {
        this.pollTimeoutId = setTimeout(
          () => this.poll(),
          TASK_QUEUE_LIMITS.processorPollIntervalMs,
        )
        return
      }

      const taskId = await this.taskService.acquireTask(this.workerId)
      if (taskId) {
        this.activeTaskCount++
        this.processTask(taskId).finally(() => {
          this.activeTaskCount--
        })
      }
    } catch (error) {
      this.logger.error(`Poll error: ${error.message}`, error.stack)
    }

    this.pollTimeoutId = setTimeout(
      () => this.poll(),
      TASK_QUEUE_LIMITS.processorPollIntervalMs,
    )
  }

  private async processTask(taskId: string) {
    const task = await this.taskService.getTask(taskId)
    if (!task) {
      this.logger.warn(`Task not found after acquire: id=${taskId}`)
      return
    }

    const handler = this.handlers.get(task.type)
    if (!handler) {
      this.logger.error(`No handler for task type: ${task.type}`)
      await this.taskService.updateStatus(taskId, TaskStatus.Failed, {
        completedAt: String(Date.now()),
        error: `No handler registered for task type: ${task.type}`,
      })
      await this.taskService.releaseLock(taskId)
      return
    }

    this.logger.log(
      `Processing task: id=${taskId} type=${task.type} retry=${task.retryCount}`,
    )

    const controller = new AbortController()
    this.activeAbortControllers.set(taskId, controller)

    const heartbeatInterval = setInterval(async () => {
      try {
        const renewed = await this.taskService.renewLock(taskId, this.workerId)
        if (!renewed) {
          this.logger.warn(`Failed to renew lock: id=${taskId}`)
          controller.abort()
        }
      } catch (error) {
        this.logger.error(`Heartbeat error: ${error.message}`)
      }
    }, TASK_QUEUE_TTL_MS.heartbeatInterval)

    const cancelCheckInterval = setInterval(async () => {
      try {
        const isCancelled = await this.taskService.isTaskCancelled(taskId)
        if (isCancelled) {
          this.logger.log(`Task cancelled by user: id=${taskId}`)
          controller.abort()
        }
      } catch (error) {
        this.logger.error(`Cancel check error: ${error.message}`)
      }
    }, TASK_QUEUE_LIMITS.cancelCheckIntervalMs)

    let handlerSetStatus: TaskStatus | null = null

    const context: TaskExecuteContext = {
      taskId,
      signal: controller.signal,
      updateProgress: (progress, message, completed, total) =>
        this.taskService.updateProgress(
          taskId,
          progress,
          message,
          completed,
          total,
        ),
      incrementTokens: (count = 1) =>
        this.taskService.incrementTokens(taskId, count),
      appendLog: (level, message) =>
        this.taskService.appendLog(taskId, level, message),
      setResult: (result) => this.taskService.setResult(taskId, result),
      setStatus: (status) => {
        handlerSetStatus = status
      },
      isAborted: () => controller.signal.aborted,
    }

    try {
      await handler.execute(task.payload, context)

      const finalStatus = await this.taskService.isTaskCancelled(taskId)
      if (finalStatus) {
        await this.taskService.appendLog(
          taskId,
          'warn',
          'Task cancelled but work completed',
        )
      } else {
        const status = handlerSetStatus ?? TaskStatus.Completed

        // Use appropriate progress message and log based on final status
        const statusMessages: Record<
          string,
          { progress: string; log: string }
        > = {
          [TaskStatus.Completed]: {
            progress: 'Completed',
            log: 'Task completed',
          },
          [TaskStatus.PartialFailed]: {
            progress: 'Completed with errors',
            log: 'Task completed with partial failures',
          },
          [TaskStatus.Failed]: {
            progress: 'Failed',
            log: 'Task failed',
          },
        }
        const messages =
          statusMessages[status] ?? statusMessages[TaskStatus.Completed]

        await this.taskService.updateProgress(taskId, 100, messages.progress)
        await this.taskService.updateStatus(taskId, status, {
          completedAt: String(Date.now()),
        })
        await this.taskService.appendLog(taskId, 'info', messages.log)
      }

      this.logger.log(
        `Task finished: id=${taskId} status=${handlerSetStatus ?? TaskStatus.Completed}`,
      )
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        this.logger.log(`Task aborted: id=${taskId}`)
        await this.taskService.appendLog(taskId, 'info', 'Task aborted')
      } else {
        this.logger.error(
          `Task failed: id=${taskId} error=${error.message}`,
          error.stack,
        )
        await this.taskService.updateStatus(taskId, TaskStatus.Failed, {
          completedAt: String(Date.now()),
          error: error.message,
        })
        await this.taskService.appendLog(
          taskId,
          'error',
          `Task failed: ${error.message}`,
        )
      }
    } finally {
      clearInterval(heartbeatInterval)
      clearInterval(cancelCheckInterval)
      this.activeAbortControllers.delete(taskId)
      await this.taskService.releaseLock(taskId)
    }
  }
}
