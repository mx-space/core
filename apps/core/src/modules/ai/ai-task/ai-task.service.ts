import { Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
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
  constructor(
    private readonly taskQueueService: TaskQueueService,
    private readonly databaseService: DatabaseService,
  ) {}

  async createSummaryTask(
    payload: SummaryTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    // Auto-fill title if not provided
    if (!payload.title && payload.refId) {
      const articleInfo = await this.getArticleInfo(payload.refId)
      if (articleInfo) {
        payload.title = articleInfo.title
        payload.refType = articleInfo.type
      }
    }
    return this.createTask(AITaskType.Summary, payload)
  }

  async createTranslationTask(
    payload: TranslationTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    // Auto-fill title if not provided
    if (!payload.title && payload.refId) {
      const articleInfo = await this.getArticleInfo(payload.refId)
      if (articleInfo) {
        payload.title = articleInfo.title
        payload.refType = articleInfo.type
      }
    }
    return this.createTask(AITaskType.Translation, payload)
  }

  private async getArticleInfo(
    refId: string,
  ): Promise<{ title: string; type: string } | null> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article || !article.document) {
      return null
    }

    const typeMap: Record<CollectionRefTypes, string> = {
      [CollectionRefTypes.Post]: 'Post',
      [CollectionRefTypes.Note]: 'Note',
      [CollectionRefTypes.Page]: 'Page',
      [CollectionRefTypes.Recently]: 'Recently',
    }

    return {
      title: (article.document as { title?: string }).title || refId,
      type: typeMap[article.type] || 'Unknown',
    }
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

  async retryTask(
    taskId: string,
  ): Promise<{ taskId: string; created: boolean }> {
    const task = await this.taskQueueService.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }

    // Only allow retry for failed, partial_failed, or cancelled tasks
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

    const type = task.type as AITaskType
    const payload = task.payload as AITaskPayload

    // Create a new task with the same type and payload
    // Use a unique dedupKey to avoid deduplication
    const dedupKey = `${computeAITaskDedupKey(type, payload)}:retry:${Date.now()}`

    return this.taskQueueService.createTask({
      type,
      payload: payload as Record<string, unknown>,
      dedupKey,
      groupId: task.groupId,
    })
  }
}
