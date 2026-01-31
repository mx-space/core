import { Injectable } from '@nestjs/common'
import {
  TaskQueueService,
  TaskStatus,
  type Task,
} from '~/processors/task-queue'
import {
  AITaskType,
  computeAITaskDedupKey,
  type AITaskPayload,
  type SummaryTaskPayload,
  type TranslationAllTaskPayload,
  type TranslationBatchTaskPayload,
  type TranslationTaskPayload,
} from './ai-task.types'

@Injectable()
export class AiTaskService {
  constructor(private readonly taskQueueService: TaskQueueService) {}

  async createSummaryTask(
    payload: SummaryTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.Summary, payload)
  }

  async createTranslationTask(
    payload: TranslationTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.Translation, payload)
  }

  async createTranslationBatchTask(
    payload: TranslationBatchTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.TranslationBatch, payload)
  }

  async createTranslationAllTask(
    payload: TranslationAllTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.TranslationAll, payload)
  }

  private async createTask(
    type: AITaskType,
    payload: AITaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    const dedupKey = computeAITaskDedupKey(type, payload)
    return this.taskQueueService.createTask({
      type,
      payload: payload as Record<string, unknown>,
      dedupKey,
    })
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskQueueService.getTask(taskId)
  }

  async getTasks(options: {
    status?: TaskStatus
    type?: AITaskType
    page: number
    size: number
  }): Promise<{ data: Task[]; total: number }> {
    return this.taskQueueService.getTasks({
      status: options.status,
      type: options.type,
      page: options.page,
      size: options.size,
    })
  }

  async cancelTask(taskId: string): Promise<boolean> {
    return this.taskQueueService.cancelTask(taskId)
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.taskQueueService.deleteTask(taskId)
  }

  async deleteTasks(options: {
    status?: TaskStatus
    type?: AITaskType
    before: number
  }): Promise<number> {
    return this.taskQueueService.deleteTasks({
      status: options.status,
      type: options.type,
      before: options.before,
    })
  }

  async getTasksByGroupId(groupId: string): Promise<Task[]> {
    return this.taskQueueService.getTasksByGroupId(groupId)
  }

  async cancelTasksByGroupId(groupId: string): Promise<number> {
    return this.taskQueueService.cancelTasksByGroupId(groupId)
  }
}
