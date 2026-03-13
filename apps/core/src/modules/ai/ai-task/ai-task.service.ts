import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { ScopedTaskService, TaskQueueService } from '~/processors/task-queue'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'

import {
  type AITaskPayload,
  AITaskType,
  computeAITaskDedupKey,
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

  async createSlugBackfillTask(
    payload: SlugBackfillTaskPayload,
  ): Promise<{ taskId: string; created: boolean }> {
    return this.createTask(AITaskType.SlugBackfill, payload)
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
