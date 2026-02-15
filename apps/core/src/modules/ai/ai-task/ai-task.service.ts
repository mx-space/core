import { Injectable } from '@nestjs/common'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { ScopedTaskService, TaskQueueService } from '~/processors/task-queue'
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
  readonly crud: ScopedTaskService

  constructor(
    taskQueueService: TaskQueueService,
    private readonly databaseService: DatabaseService,
  ) {
    this.crud = new ScopedTaskService(taskQueueService, 'ai')
  }

  async createSummaryTask(
    payload: SummaryTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
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
    if (!payload.title && payload.refId) {
      const articleInfo = await this.getArticleInfo(payload.refId)
      if (articleInfo) {
        payload.title = articleInfo.title
        payload.refType = articleInfo.type
      }
    }
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
    return this.crud.createTask({
      type,
      payload: payload as Record<string, unknown>,
      dedupKey,
    })
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
}
