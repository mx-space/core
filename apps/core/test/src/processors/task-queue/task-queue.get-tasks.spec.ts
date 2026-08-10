import { describe, expect, it, vi } from 'vitest'

import { TaskQueueService } from '~/processors/task-queue/task-queue.service'
import type { Task } from '~/processors/task-queue/task-queue.types'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'

interface StoredTask {
  id: string
  status: string
  scope: string
  groupId: string
  payload: string | null
}

function buildHarness(tasks: StoredTask[]) {
  const hmgetFields: string[][] = []
  const redis = {
    zrevrange: vi.fn(async (_key: string, start: number, stop: number) =>
      tasks.slice(start, stop + 1).map((task) => task.id),
    ),
    pipeline: () => {
      const queued: Array<{ id: string; fields: string[] }> = []
      const chain = {
        hmget(key: string, ...fields: string[]) {
          hmgetFields.push(fields)
          queued.push({ id: key.split(':').pop()!, fields })
          return chain
        },
        async exec() {
          return queued.map(({ id, fields }) => {
            const task = tasks.find((candidate) => candidate.id === id)!
            return [
              null,
              fields.map(
                (field) => (task as unknown as Record<string, string>)[field],
              ),
            ]
          })
        },
      }
      return chain
    },
  }

  const service = new TaskQueueService(
    { getClient: () => redis } as any,
    {} as any,
    {} as any,
  )
  vi.spyOn(service, 'getTask').mockImplementation(
    async (taskId: string) => ({ id: taskId }) as Task,
  )

  return { hmgetFields, service }
}

const task = (over: Partial<StoredTask> & { id: string }): StoredTask => ({
  status: TaskStatus.Running,
  scope: 'ai',
  groupId: '',
  payload: JSON.stringify({ refId: 'post-1' }),
  ...over,
})

describe('TaskQueueService.getTasks — refId filter', () => {
  it('keeps only the tasks whose payload targets the ref', async () => {
    const { service } = buildHarness([
      task({ id: 'a' }),
      task({ id: 'b', payload: JSON.stringify({ refId: 'post-2' }) }),
      task({ id: 'c' }),
    ])

    const result = await service.getTasks({
      scope: 'ai',
      page: 1,
      size: 10,
      refId: 'post-1',
    })

    expect(result.data.map((row) => row.id)).toEqual(['a', 'c'])
    expect(result.total).toBe(2)
  })

  it('matches a batch task through its refIds list', async () => {
    const { service } = buildHarness([
      task({
        id: 'batch',
        payload: JSON.stringify({ refIds: ['post-2', 'post-1'] }),
      }),
    ])

    const result = await service.getTasks({
      scope: 'ai',
      page: 1,
      size: 10,
      refId: 'post-1',
    })

    expect(result.data.map((row) => row.id)).toEqual(['batch'])
  })

  it('drops tasks with a missing or unparsable payload instead of throwing', async () => {
    const { service } = buildHarness([
      task({ id: 'empty', payload: null }),
      task({ id: 'broken', payload: '{oops' }),
      task({ id: 'ok' }),
    ])

    const result = await service.getTasks({
      scope: 'ai',
      page: 1,
      size: 10,
      refId: 'post-1',
    })

    expect(result.data.map((row) => row.id)).toEqual(['ok'])
  })

  it('surfaces a child task of a batch group when sub-tasks are included', async () => {
    const { service } = buildHarness([task({ id: 'child', groupId: 'G1' })])

    const excluded = await service.getTasks({
      scope: 'ai',
      page: 1,
      size: 10,
      refId: 'post-1',
    })
    const included = await service.getTasks({
      scope: 'ai',
      page: 1,
      size: 10,
      refId: 'post-1',
      includeSubTasks: true,
    })

    expect(excluded.data).toEqual([])
    expect(included.data.map((row) => row.id)).toEqual(['child'])
  })

  it('does not read payloads at all when no ref is requested', async () => {
    const { hmgetFields, service } = buildHarness([task({ id: 'a' })])

    await service.getTasks({ scope: 'ai', page: 1, size: 10 })

    expect(hmgetFields.every((fields) => !fields.includes('payload'))).toBe(
      true,
    )
  })
})
