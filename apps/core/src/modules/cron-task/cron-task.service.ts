import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import {
  ScopedTaskService,
  TaskQueueProcessor,
  TaskQueueService,
  type TaskExecuteContext,
} from '~/processors/task-queue'
import { CronBusinessService } from './cron-business.service'
import {
  CronTaskMetas,
  type CronTaskDefinition,
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
