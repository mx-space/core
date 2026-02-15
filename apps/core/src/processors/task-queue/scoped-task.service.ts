import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { CreateTaskOptions, TaskQueueService } from './task-queue.service'
import { TaskStatus, type Task } from './task-queue.types'

export class ScopedTaskService {
  constructor(
    private readonly taskQueueService: TaskQueueService,
    private readonly scope: string,
  ) {}

  private async verifyScope(taskId: string): Promise<Task> {
    const task = await this.taskQueueService.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }
    if (task.scope !== this.scope) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }
    return task
  }

  createTask(options: Omit<CreateTaskOptions, 'scope'>) {
    return this.taskQueueService.createTask({ ...options, scope: this.scope })
  }

  async getTask(taskId: string) {
    return this.verifyScope(taskId)
  }

  getTasks(options: {
    status?: TaskStatus
    type?: string
    page: number
    size: number
    includeSubTasks?: boolean
  }) {
    return this.taskQueueService.getTasks({
      ...options,
      scope: this.scope,
    })
  }

  async cancelTask(taskId: string) {
    await this.verifyScope(taskId)
    return this.taskQueueService.cancelTask(taskId)
  }

  async deleteTask(taskId: string) {
    await this.verifyScope(taskId)
    return this.taskQueueService.deleteTask(taskId)
  }

  deleteTasks(options: { status?: TaskStatus; type?: string; before: number }) {
    return this.taskQueueService.deleteTasks({
      ...options,
      scope: this.scope,
    })
  }

  async getTasksByGroupId(groupId: string) {
    const tasks = await this.taskQueueService.getTasksByGroupId(groupId)
    return tasks.filter((t) => t.scope === this.scope)
  }

  async cancelTasksByGroupId(groupId: string) {
    const tasks = await this.taskQueueService.getTasksByGroupId(groupId)
    let cancelled = 0
    for (const task of tasks) {
      if (task.scope !== this.scope) continue
      try {
        const ok = await this.taskQueueService.cancelTask(task.id)
        if (ok) cancelled++
      } catch {
        // ignore
      }
    }
    return cancelled
  }

  async retryTask(
    taskId: string,
    createTaskFn?: (
      task: Task,
    ) => Promise<{ taskId: string; created: boolean }>,
  ): Promise<{ taskId: string; created: boolean }> {
    const task = await this.verifyScope(taskId)

    if (
      task.status !== TaskStatus.Failed &&
      task.status !== TaskStatus.PartialFailed &&
      task.status !== TaskStatus.Cancelled
    ) {
      throw new BizException(
        ErrorCodeEnum.AITaskCannotRetry,
        'Only failed, partial_failed, or cancelled tasks can be retried',
      )
    }

    if (createTaskFn) {
      return createTaskFn(task)
    }

    return this.createTask({
      type: task.type,
      payload: task.payload as Record<string, unknown>,
      dedupKey: `${task.type}:retry:${Date.now()}`,
      groupId: task.groupId,
    })
  }
}
