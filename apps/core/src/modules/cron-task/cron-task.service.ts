import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { TaskQueueProcessor } from '~/processors/task-queue/task-queue.processor'
import {
  TaskQueueService,
  type CreateTaskOptions,
} from '~/processors/task-queue/task-queue.service'
import {
  TaskStatus,
  type Task,
  type TaskExecuteContext,
} from '~/processors/task-queue/task-queue.types'
import { CronBusinessService } from './cron-business.service'
import {
  CronTaskMetas,
  CronTaskType,
  type CronTaskDefinition,
  type CronTaskTypeValue,
} from './cron-task.types'

@Injectable()
export class CronTaskService implements OnModuleInit {
  private readonly logger = new Logger(CronTaskService.name)

  constructor(
    private readonly taskQueueService: TaskQueueService,
    private readonly taskQueueProcessor: TaskQueueProcessor,
    private readonly cronBusinessService: CronBusinessService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.registerTaskHandlers()
  }

  private registerTaskHandlers() {
    for (const [type, _meta] of Object.entries(CronTaskMetas)) {
      this.taskQueueProcessor.registerHandler({
        type,
        execute: async (
          _payload: Record<string, unknown>,
          context: TaskExecuteContext,
        ) => {
          await this.executeCronTask(type as CronTaskTypeValue, context)
        },
      })
    }
    this.logger.log(
      `Registered ${Object.keys(CronTaskMetas).length} cron task handlers`,
    )
  }

  private async executeCronTask(
    type: CronTaskTypeValue,
    context: TaskExecuteContext,
  ): Promise<void> {
    const meta = CronTaskMetas[type]
    if (!meta) {
      throw new Error(`Unknown cron task type: ${type}`)
    }

    const methodName = meta.methodName as keyof CronBusinessService
    const method = this.cronBusinessService[methodName]
    if (typeof method !== 'function') {
      throw new TypeError(`Cron method not found: ${String(methodName)}`)
    }

    await context.appendLog('info', `开始执行: ${meta.description}`)
    await context.updateProgress(0, '执行中...')

    try {
      const result = await method.call(this.cronBusinessService)
      await context.updateProgress(100, '完成')

      if (result !== undefined && result !== null) {
        await context.setResult(result)
        await context.appendLog('info', `执行完成: ${JSON.stringify(result)}`)
      } else {
        await context.setResult({ success: true })
        await context.appendLog('info', '执行完成')
      }
    } catch (error) {
      await context.appendLog('error', `执行失败: ${error.message}`)
      throw error
    }
  }

  async createCronTask(
    type: CronTaskTypeValue,
  ): Promise<{ taskId: string; created: boolean }> {
    const meta = CronTaskMetas[type]
    if (!meta) {
      throw new BizException(ErrorCodeEnum.CronNotFound, type)
    }

    const options: CreateTaskOptions = {
      type,
      payload: {},
      dedupKey: type,
    }

    return this.taskQueueService.createTask(options)
  }

  async getCronDefinitions(): Promise<CronTaskDefinition[]> {
    const definitions: CronTaskDefinition[] = []

    for (const [type, meta] of Object.entries(CronTaskMetas)) {
      let lastDate: string | null = null
      let nextDate: string | null = null

      try {
        const job = this.schedulerRegistry.getCronJob(meta.name)
        if (job) {
          const last = job.lastDate()
          const next = job.nextDate()
          lastDate = last ? String(last) : null
          nextDate = next ? String(next) : null
        }
      } catch {
        // Job might not be registered if running in non-primary process
      }

      definitions.push({
        type: type as CronTaskTypeValue,
        name: meta.name,
        description: meta.description,
        cronExpression: meta.cronExpression,
        lastDate,
        nextDate,
      })
    }

    return definitions
  }

  async getTasks(options: {
    status?: TaskStatus
    type?: CronTaskTypeValue
    page: number
    size: number
  }): Promise<{ data: Task[]; total: number }> {
    const { status, type, page, size } = options

    // Get all cron task types
    const cronTypes = Object.values(CronTaskType)

    // If specific type is requested, filter to that type only
    if (type) {
      return this.taskQueueService.getTasks({
        status,
        type,
        page,
        size,
        includeSubTasks: false,
      })
    }

    // Otherwise, get all tasks and filter to cron types only
    const result = await this.taskQueueService.getTasks({
      status,
      page: 1,
      size: 10000,
      includeSubTasks: false,
    })

    const cronTasks = result.data.filter((task) =>
      cronTypes.includes(task.type as CronTaskTypeValue),
    )

    const total = cronTasks.length
    const start = (page - 1) * size
    const paginatedTasks = cronTasks.slice(start, start + size)

    return { data: paginatedTasks, total }
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskQueueService.getTask(taskId)
  }

  async cancelTask(taskId: string): Promise<boolean> {
    return this.taskQueueService.cancelTask(taskId)
  }

  async retryTask(
    taskId: string,
  ): Promise<{ taskId: string; created: boolean }> {
    const task = await this.taskQueueService.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }

    if (
      task.status !== TaskStatus.Failed &&
      task.status !== TaskStatus.Cancelled
    ) {
      throw new BizException(
        ErrorCodeEnum.AITaskCannotRetry,
        'Task is not in a retryable state',
      )
    }

    return this.createCronTask(task.type as CronTaskTypeValue)
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.taskQueueService.deleteTask(taskId)
  }

  async deleteTasks(options: {
    status?: TaskStatus
    type?: CronTaskTypeValue
    before: number
  }): Promise<number> {
    return this.taskQueueService.deleteTasks(options)
  }
}
