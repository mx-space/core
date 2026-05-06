import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { ScopedTaskService, TaskQueueService } from '~/processors/task-queue'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'

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

  async retryTaskWithFailedOnly(
    taskId: string,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.crud.retryTask(taskId, async (task) => {
      if (
        task.type === AITaskType.Translation &&
        task.status === TaskStatus.PartialFailed
      ) {
        const payload = task.payload as unknown as TranslationTaskPayload
        const result = task.result as {
          translations?: Array<{ lang: string }>
        }
        const targetLangs = payload.targetLanguages || []
        const successLangs = new Set(
          result?.translations?.map((t) => t.lang) || [],
        )
        const failedLangs = targetLangs.filter(
          (lang) => !successLangs.has(lang),
        )

        if (failedLangs.length > 0) {
          const retryPayload: TranslationTaskPayload = {
            refId: payload.refId,
            targetLanguages: failedLangs,
            title: payload.title,
            refType: payload.refType,
          }
          const dedupKey = computeAITaskDedupKey(
            AITaskType.Translation,
            retryPayload,
          )
          return this.crud.createTask({
            type: AITaskType.Translation,
            payload: retryPayload as unknown as Record<string, unknown>,
            dedupKey,
            groupId: task.groupId,
          })
        }
      }

      return this.crud.createTask({
        type: task.type,
        payload: task.payload as Record<string, unknown>,
        dedupKey: `${task.type}:retry:${Date.now()}`,
        groupId: task.groupId,
      })
    })
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
