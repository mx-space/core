import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { TaskQueueService } from '~/processors/task-queue/task-queue.service'
import type { Task } from '~/processors/task-queue/task-queue.types'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'

describe('TaskQueueService — retryTask', () => {
  function buildHarness(
    opts: {
      task?: Partial<Task> | null
      retryBuilder?: ReturnType<typeof vi.fn> | null
    } = {},
  ) {
    const service = new TaskQueueService(
      {} as any,
      {} as any,
      { getRetryBuilder: () => opts.retryBuilder ?? undefined } as any,
    )

    const fullTask: Task | null =
      opts.task === null
        ? null
        : ({
            id: 'orig-1',
            type: 'ai:summary',
            status: TaskStatus.Failed,
            payload: { ref: 'p1' },
            scope: 'ai',
            groupId: 'G1',
            createdAt: 0,
            logs: [],
            retryCount: 0,
            ...opts.task,
          } as Task)

    vi.spyOn(service, 'getTask').mockResolvedValue(fullTask)
    const createTask = vi
      .spyOn(service, 'createTask')
      .mockResolvedValue({ taskId: 'new-1', created: true })

    return { service, createTask }
  }

  it('throws TASK_NOT_FOUND when the task is missing', async () => {
    const { service } = buildHarness({ task: null })
    await expect(service.retryTask('missing')).rejects.toMatchObject({
      code: AppErrorCode.TASK_NOT_FOUND,
    })
  })

  it('throws TASK_CANNOT_RETRY for a non-retryable status', async () => {
    const { service } = buildHarness({ task: { status: TaskStatus.Running } })
    await expect(service.retryTask('orig-1')).rejects.toMatchObject({
      code: AppErrorCode.TASK_CANNOT_RETRY,
    })
  })

  it.each([TaskStatus.Failed, TaskStatus.PartialFailed, TaskStatus.Cancelled])(
    'allows retry for %s status',
    async (status) => {
      const { service, createTask } = buildHarness({ task: { status } })
      const result = await service.retryTask('orig-1')

      expect(result).toEqual({ taskId: 'new-1', created: true })
      expect(createTask).toHaveBeenCalledTimes(1)
    },
  )

  it('default path re-enqueues type/payload/groupId/scope with a retry dedupKey', async () => {
    const { service, createTask } = buildHarness()
    const result = await service.retryTask('orig-1')

    expect(result).toEqual({ taskId: 'new-1', created: true })
    expect(createTask).toHaveBeenCalledTimes(1)
    const args = createTask.mock.calls[0][0]
    expect(args.type).toBe('ai:summary')
    expect(args.payload).toEqual({ ref: 'p1' })
    expect(args.groupId).toBe('G1')
    expect(args.scope).toBe('ai')
    expect(args.dedupKey).toMatch(/^ai:summary:retry:\d+$/)
  })

  it('uses a registered buildRetryTask hook and preserves original scope', async () => {
    const retryBuilder = vi.fn().mockResolvedValue({
      type: 'ai:summary',
      payload: { ref: 'rebuilt' },
      dedupKey: 'custom',
    })
    const { service, createTask } = buildHarness({ retryBuilder })

    await service.retryTask('orig-1')

    expect(retryBuilder).toHaveBeenCalledTimes(1)
    const passedTask = retryBuilder.mock.calls[0][0]
    expect(passedTask.id).toBe('orig-1')

    const args = createTask.mock.calls[0][0]
    expect(args.payload).toEqual({ ref: 'rebuilt' })
    expect(args.dedupKey).toBe('custom')
    expect(args.scope).toBe('ai')
  })

  it('lets the hook override scope when it supplies one', async () => {
    const retryBuilder = vi.fn().mockResolvedValue({
      type: 'ai:summary',
      payload: {},
      scope: 'enrichment',
    })
    const { service, createTask } = buildHarness({ retryBuilder })

    await service.retryTask('orig-1')

    expect(createTask.mock.calls[0][0].scope).toBe('enrichment')
  })
})
