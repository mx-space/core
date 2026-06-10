import { createE2EApp } from 'test/helper/create-e2e-app'
import { createPgRepositoryMock } from 'test/helper/pg-repository-mock'
import { redisHelper } from 'test/helper/redis-mock.helper'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import {
  AITaskType,
  computeAITaskDedupKey,
  type TranslationTaskPayload,
} from '~/modules/ai/ai-task/ai-task.types'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { TaskController } from '~/modules/task/task.controller'
import {
  type Task,
  TaskQueueService,
  TaskStatus,
} from '~/processors/task-queue'

const noopEmitter = {
  emitCreated: vi.fn(),
  emitStarted: vi.fn(),
  emitStatus: vi.fn(),
  emitResult: vi.fn(),
  emitDeleted: vi.fn(),
  emitLog: vi.fn(),
  emitStream: vi.fn(),
  emitProgress: vi.fn(),
  dispose: vi.fn(),
}

const retryBuilders = new Map<string, (task: Task) => unknown>()

const processorStub = {
  registerHandler: (handler: { type: string; buildRetryTask?: any }) => {
    if (handler.buildRetryTask) {
      retryBuilders.set(handler.type, handler.buildRetryTask)
    }
  },
  getRetryBuilder: (type: string) => retryBuilders.get(type),
}

let service: TaskQueueService

async function seedTask(opts: {
  type?: string
  payload?: Record<string, unknown>
  scope?: string
  groupId?: string
  status?: TaskStatus
  result?: unknown
}): Promise<string> {
  const { taskId } = await service.createTask({
    type: opts.type ?? 'generic:job',
    payload: opts.payload ?? { foo: 'bar' },
    scope: opts.scope,
    groupId: opts.groupId,
  })
  if (opts.result !== undefined) {
    await service.setResult(taskId, opts.result)
  }
  if (opts.status && opts.status !== TaskStatus.Pending) {
    await service.updateStatus(taskId, opts.status)
  }
  return taskId
}

describe('TaskController (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [TaskController],
    providers: [
      {
        provide: TaskQueueService,
        useFactory: async () =>
          new TaskQueueService(
            (await redisHelper).RedisService as any,
            noopEmitter as any,
            processorStub as any,
          ),
      },
    ],
  })

  beforeEach(async () => {
    const { RedisService: redis } = await redisHelper
    await redis.getClient().flushall()
    service = proxy.app.get(TaskQueueService)
    retryBuilders.clear()
  })

  describe('GET /tasks — listing + filters', () => {
    it('returns { data, meta.pagination } wire shape', async () => {
      await seedTask({ scope: 'ai' })
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.meta.pagination).toMatchObject({ total: 1 })
    })

    it('scope filter separates ai from enrichment tasks', async () => {
      await seedTask({ scope: 'ai', type: 'ai:summary' })
      await seedTask({ scope: 'ai', type: 'ai:translation' })
      await seedTask({ scope: 'enrichment', type: 'enrichment:og' })

      const aiRes = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?scope=ai`,
        headers: authPassHeader,
      })
      expect(aiRes.json().data).toHaveLength(2)
      expect(aiRes.json().data.every((t: any) => t.scope === 'ai')).toBe(true)

      const enrichRes = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?scope=enrichment`,
        headers: authPassHeader,
      })
      expect(enrichRes.json().data).toHaveLength(1)
      expect(enrichRes.json().data[0].scope).toBe('enrichment')
    })

    it('type filter returns only matching type', async () => {
      await seedTask({ type: 'ai:summary' })
      await seedTask({ type: 'ai:translation' })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?type=ai:summary`,
        headers: authPassHeader,
      })
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].type).toBe('ai:summary')
    })

    it('status filter returns only matching status (snake_case wire value)', async () => {
      await seedTask({ status: TaskStatus.Failed })
      await seedTask({ status: TaskStatus.Pending })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?status=failed`,
        headers: authPassHeader,
      })
      expect(res.json().data).toHaveLength(1)
      expect(res.json().data[0].status).toBe('failed')
    })

    it('comma-separated status filter returns the union', async () => {
      await seedTask({ status: TaskStatus.Pending })
      await seedTask({ status: TaskStatus.Running })
      await seedTask({ status: TaskStatus.Completed })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?status=pending,running`,
        headers: authPassHeader,
      })
      const statuses = res
        .json()
        .data.map((t: any) => t.status)
        .sort()
      expect(statuses).toEqual(['pending', 'running'])
    })

    it('multi-status combines with scope filter', async () => {
      await seedTask({ scope: 'ai', status: TaskStatus.Failed })
      await seedTask({ scope: 'ai', status: TaskStatus.PartialFailed })
      await seedTask({ scope: 'ai', status: TaskStatus.Completed })
      await seedTask({ scope: 'enrichment', status: TaskStatus.Failed })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?scope=ai&status=failed,partial_failed`,
        headers: authPassHeader,
      })
      const rows = res.json().data
      expect(rows).toHaveLength(2)
      expect(rows.every((t: any) => t.scope === 'ai')).toBe(true)
      expect(rows.map((t: any) => t.status).sort()).toEqual([
        'failed',
        'partial_failed',
      ])
    })

    it('rejects an invalid status value in the list', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?status=pending,bogus`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.code).toBe('VALIDATION_FAILED')
    })

    it('include_sub_tasks=false hides grouped sub-tasks, =true shows them', async () => {
      await seedTask({ type: 'parent:job' })
      await seedTask({ type: 'child:job', groupId: 'G-1' })

      const hidden = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?include_sub_tasks=false`,
        headers: authPassHeader,
      })
      expect(hidden.json().data).toHaveLength(1)
      expect(hidden.json().data[0].group_id).toBeUndefined()

      const shown = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks?include_sub_tasks=true`,
        headers: authPassHeader,
      })
      expect(shown.json().data).toHaveLength(2)
      const child = shown.json().data.find((t: any) => t.type === 'child:job')
      expect(child.group_id).toBe('G-1')
    })
  })

  describe('POST /tasks/:id/retry — generic default path', () => {
    it('re-enqueues a new task with same type/payload/scope', async () => {
      const id = await seedTask({
        type: 'generic:job',
        payload: { ref: 'p1' },
        scope: 'ai',
        status: TaskStatus.Failed,
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(201)
      const newId = res.json().data.task_id
      expect(newId).toBeTruthy()
      expect(newId).not.toBe(id)

      const created = await service.getTask(newId)
      expect(created?.type).toBe('generic:job')
      expect(created?.payload).toEqual({ ref: 'p1' })
      expect(created?.scope).toBe('ai')
      expect(created?.status).toBe(TaskStatus.Pending)
    })

    it('400 TASK_CANNOT_RETRY for a non-retryable status', async () => {
      const id = await seedTask({ status: TaskStatus.Pending })
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('TASK_CANNOT_RETRY')
    })

    it('404 TASK_NOT_FOUND for unknown id', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/does-not-exist/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().error.code).toBe('TASK_NOT_FOUND')
    })
  })

  describe('AI translation retry hook (buildTranslationRetryTask)', () => {
    const buildTranslationService = () => {
      const repository = createPgRepositoryMock()
      const stubs = {
        databaseService: {},
        translationConsistencyService: {},
        partialBuilder: {},
        configService: { get: vi.fn() },
        aiService: {},
        aiInFlightService: {},
        eventManager: { emit: vi.fn() },
        lexicalService: {},
        aiTaskService: {},
        lexicalStrategy: {},
        markdownStrategy: {},
      }
      const aiTranslationService = new AiTranslationService(
        repository as any,
        stubs.databaseService as any,
        stubs.translationConsistencyService as any,
        stubs.partialBuilder as any,
        stubs.configService as any,
        stubs.aiService as any,
        stubs.aiInFlightService as any,
        stubs.eventManager as any,
        processorStub as any,
        service,
        stubs.lexicalService as any,
        stubs.aiTaskService as any,
        stubs.lexicalStrategy as any,
        stubs.markdownStrategy as any,
      )
      aiTranslationService.onModuleInit()
    }

    it('partial_failed retry targets only the failed languages, preserves groupId, uses computeAITaskDedupKey', async () => {
      buildTranslationService()

      const payload: TranslationTaskPayload = {
        refId: 'post-1',
        targetLanguages: ['en', 'ja', 'ko'],
        title: 'Hello',
        refType: 'post',
      }
      const id = await seedTask({
        type: AITaskType.Translation,
        scope: 'ai',
        groupId: 'BATCH-1',
        payload: payload as unknown as Record<string, unknown>,
        result: { translations: [{ lang: 'en' }] },
        status: TaskStatus.PartialFailed,
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(201)

      const created = await service.getTask(res.json().data.task_id)
      expect((created?.payload as any).targetLanguages).toEqual(['ja', 'ko'])
      expect((created?.payload as any).refId).toBe('post-1')
      expect(created?.groupId).toBe('BATCH-1')
      expect(created?.type).toBe(AITaskType.Translation)

      const expectedDedup = computeAITaskDedupKey(AITaskType.Translation, {
        refId: 'post-1',
        targetLanguages: ['ja', 'ko'],
        title: 'Hello',
        refType: 'post',
      })
      const dedupHit = await service.createTask({
        type: AITaskType.Translation,
        payload: { refId: 'post-1', targetLanguages: ['ja', 'ko'] },
        dedupKey: expectedDedup,
        groupId: 'BATCH-1',
      })
      expect(dedupHit.created).toBe(false)
      expect(dedupHit.taskId).toBe(created?.id)
    })

    it('falls back to default retry shape when no failed languages remain', async () => {
      buildTranslationService()

      const payload: TranslationTaskPayload = {
        refId: 'post-2',
        targetLanguages: ['en'],
      }
      const id = await seedTask({
        type: AITaskType.Translation,
        scope: 'ai',
        groupId: 'BATCH-2',
        payload: payload as unknown as Record<string, unknown>,
        result: { translations: [{ lang: 'en' }] },
        status: TaskStatus.PartialFailed,
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(201)

      const created = await service.getTask(res.json().data.task_id)
      expect((created?.payload as any).targetLanguages).toEqual(['en'])
      expect(created?.groupId).toBe('BATCH-2')
    })

    it('falls back to default retry shape for a plain failed (not partial_failed) task', async () => {
      buildTranslationService()

      const payload: TranslationTaskPayload = {
        refId: 'post-3',
        targetLanguages: ['en', 'ja'],
      }
      const id = await seedTask({
        type: AITaskType.Translation,
        scope: 'ai',
        payload: payload as unknown as Record<string, unknown>,
        status: TaskStatus.Failed,
      })

      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/retry`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(201)

      const created = await service.getTask(res.json().data.task_id)
      expect((created?.payload as any).targetLanguages).toEqual(['en', 'ja'])
    })
  })

  describe('cancel / delete', () => {
    it('cancels a pending task → status cancelled', async () => {
      const id = await seedTask({ status: TaskStatus.Pending })
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/cancel`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.success).toBe(true)

      const task = await service.getTask(id)
      expect(task?.status).toBe(TaskStatus.Cancelled)
    })

    it('400 TASK_ALREADY_COMPLETED when cancelling a terminal task', async () => {
      const id = await seedTask({ status: TaskStatus.Completed })
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/tasks/${id}/cancel`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('TASK_ALREADY_COMPLETED')
    })

    it('DELETE /tasks/:id removes the task', async () => {
      const id = await seedTask({ status: TaskStatus.Failed })
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/tasks/${id}`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.success).toBe(true)
      expect(await service.getTask(id)).toBeNull()
    })

    it('bulk DELETE /tasks with before + status returns { deleted } count', async () => {
      const failedId = await seedTask({ status: TaskStatus.Failed })
      await seedTask({ status: TaskStatus.Completed })
      await seedTask({ status: TaskStatus.Pending })

      const failed = await service.getTask(failedId)
      const before = (failed?.createdAt ?? Date.now()) + 1
      await new Promise((resolve) => setTimeout(resolve, 50))
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/tasks?status=failed&before=${before}`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(1)
      expect(await service.getTask(failedId)).toBeNull()
    })
  })

  describe('group endpoints', () => {
    it('GET /tasks/group/:id returns group members across scopes', async () => {
      const a = await seedTask({ scope: 'ai', groupId: 'G-X', type: 'a' })
      const b = await seedTask({
        scope: 'enrichment',
        groupId: 'G-X',
        type: 'b',
      })
      await seedTask({ scope: 'ai', groupId: 'G-Y', type: 'c' })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks/group/G-X`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(200)
      const ids = res.json().data.map((t: any) => t.id)
      expect(ids).toHaveLength(2)
      expect(ids).toEqual(expect.arrayContaining([a, b]))
    })

    it('DELETE /tasks/group/:id cancels non-terminal members, returns { cancelled }', async () => {
      const pendingId = await seedTask({
        groupId: 'G-Z',
        status: TaskStatus.Pending,
      })
      await seedTask({ groupId: 'G-Z', status: TaskStatus.Completed })

      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/tasks/group/G-Z`,
        headers: authPassHeader,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.cancelled).toBe(1)

      const pending = await service.getTask(pendingId)
      expect(pending?.status).toBe(TaskStatus.Cancelled)
    })
  })

  describe('auth gating', () => {
    it('rejects unauthenticated GET /tasks', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/tasks`,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
