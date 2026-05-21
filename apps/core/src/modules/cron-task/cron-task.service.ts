import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'

import { AppErrorCode, createAppException } from '~/common/errors'
import {
  ScopedTaskService,
  type TaskExecuteContext,
  TaskQueueProcessor,
  TaskQueueService,
} from '~/processors/task-queue'

import { CronBusinessService } from './cron-business.service'
import {
  type CronTaskDefinition,
  CronTaskMetas,
  type CronTaskTypeValue,
} from './cron-task.types'

@Injectable()
export class CronTaskService implements OnModuleInit {
  private readonly logger = new Logger(CronTaskService.name)
  readonly crud: ScopedTaskService

  constructor(
    taskQueueService: TaskQueueService,
    private readonly taskQueueProcessor: TaskQueueProcessor,
    private readonly cronBusinessService: CronBusinessService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.crud = new ScopedTaskService(taskQueueService, 'cron')
  }

  onModuleInit() {
    this.registerTaskHandlers()
  }

  private registerTaskHandlers() {
    for (const type of Object.keys(CronTaskMetas)) {
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

    await context.appendLog('info', `Starting: ${meta.description}`)
    await context.updateProgress(0, 'Running...')

    try {
      const result = await method.call(this.cronBusinessService)
      await context.updateProgress(100, 'Completed')

      const hasResult = result !== undefined && result !== null
      await context.setResult(hasResult ? result : { success: true })
      await context.appendLog(
        'info',
        hasResult ? `Finished: ${JSON.stringify(result)}` : 'Finished',
      )
    } catch (error) {
      await context.appendLog('error', `Failed: ${error.message}`)
      throw error
    }
  }

  async createCronTask(
    type: CronTaskTypeValue,
  ): Promise<{ taskId: string; created: boolean }> {
    const meta = CronTaskMetas[type]
    if (!meta) {
      throw createAppException(AppErrorCode.CRON_NOT_FOUND, { extra: type })
    }

    return this.crud.createTask({
      type,
      payload: {},
      dedupKey: type,
    })
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
}
