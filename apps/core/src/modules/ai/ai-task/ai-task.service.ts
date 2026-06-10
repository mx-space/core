import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { TaskQueueService } from '~/processors/task-queue'

import {
  type AITaskPayload,
  AITaskType,
  computeAITaskDedupKey,
  type InsightsTaskPayload,
  type InsightsTranslationTaskPayload,
  type SlugBackfillTaskPayload,
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
    await this.fillArticleInfo(payload)
    return this.createTask(AITaskType.Summary, payload)
  }

  async createTranslationTask(
    payload: TranslationTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    await this.fillArticleInfo(payload)
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

  async createSlugBackfillTask(
    payload: SlugBackfillTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.SlugBackfill, payload)
  }

  async createInsightsTask(
    payload: InsightsTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    await this.fillArticleInfo(payload)
    return this.createTask(AITaskType.Insights, payload)
  }

  async createInsightsTranslationTask(
    payload: InsightsTranslationTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    await this.fillArticleInfo(payload)
    return this.createTask(AITaskType.InsightsTranslation, payload)
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
      scope: 'ai',
    })
  }

  private async fillArticleInfo(payload: {
    title?: string
    refId?: string
    refType?: string
  }): Promise<void> {
    if (payload.title || !payload.refId) return
    const articleInfo = await this.getArticleInfo(payload.refId)
    if (articleInfo) {
      payload.title = articleInfo.title
      payload.refType = articleInfo.type
    }
  }

  private async getArticleInfo(
    refId: string,
  ): Promise<{ title: string; type: CollectionRefTypes } | null> {
    const article = await this.databaseService.findGlobalById(refId)
    if (!article || !article.document) {
      return null
    }

    return {
      title: (article.document as { title?: string }).title || refId,
      type: article.type as CollectionRefTypes,
    }
  }
}
