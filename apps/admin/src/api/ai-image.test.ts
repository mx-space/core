import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveImageTaskOutcome, waitForImageTask } from './ai-image'
import type { AITask } from './tasks'
import { AITaskStatus, AITaskType } from './tasks'

const getTask = vi.fn()

vi.mock('./tasks', async () => {
  const actual = await vi.importActual<typeof import('./tasks')>('./tasks')
  return {
    ...actual,
    getTask: (...args: unknown[]) => getTask(...args),
  }
})

function task(overrides: Partial<AITask> = {}): AITask {
  return {
    createdAt: 0,
    id: 'task-1',
    logs: [],
    payload: {},
    retryCount: 0,
    status: AITaskStatus.Running,
    type: overrides.type ?? AITaskType.ImageGeneration,
    ...overrides,
  }
}

describe('resolveImageTaskOutcome', () => {
  it('returns pending while the task is running', () => {
    expect(resolveImageTaskOutcome(task())).toEqual({ status: 'pending' })
  })

  it('returns success with the url on completion', () => {
    const outcome = resolveImageTaskOutcome(
      task({
        completedAt: 123,
        result: { prompt: 'a cat', url: 'https://example.com/a.png' },
        status: AITaskStatus.Completed,
      }),
    )
    expect(outcome).toEqual({
      completedAt: 123,
      prompt: 'a cat',
      status: 'success',
      url: 'https://example.com/a.png',
    })
  })

  it('returns pending when completed but the result has not attached yet (status/result are separate socket phases)', () => {
    const outcome = resolveImageTaskOutcome(
      task({ status: AITaskStatus.Completed }),
    )
    expect(outcome).toEqual({ status: 'pending' })
  })

  it('returns failed with missing_url when completed with a result that has no url', () => {
    const outcome = resolveImageTaskOutcome(
      task({ result: { prompt: 'a cat' }, status: AITaskStatus.Completed }),
    )
    expect(outcome).toEqual({ reason: 'missing_url', status: 'failed' })
  })

  it('returns failed with task_error for a failed task', () => {
    const outcome = resolveImageTaskOutcome(
      task({ error: 'boom', status: AITaskStatus.Failed }),
    )
    expect(outcome).toEqual({
      error: 'boom',
      reason: 'task_error',
      status: 'failed',
    })
  })
})

describe('waitForImageTask', () => {
  beforeEach(() => {
    getTask.mockReset()
  })

  it('polls until the task succeeds and returns the result', async () => {
    getTask.mockResolvedValueOnce(task()).mockResolvedValueOnce(
      task({
        completedAt: 1,
        result: { url: 'https://example.com/a.png' },
        status: AITaskStatus.Completed,
      }),
    )

    const result = await waitForImageTask('task-1', { intervalMs: 0 })

    expect(result).toEqual({
      completedAt: 1,
      prompt: undefined,
      url: 'https://example.com/a.png',
    })
    expect(getTask).toHaveBeenCalledTimes(2)
  })

  it('throws when the task fails', async () => {
    getTask.mockResolvedValueOnce(
      task({ error: 'provider down', status: AITaskStatus.Failed }),
    )

    await expect(waitForImageTask('task-1', { intervalMs: 0 })).rejects.toThrow(
      'provider down',
    )
  })

  it('throws a timeout error instead of polling forever when the task stays pending', async () => {
    getTask.mockResolvedValue(task())

    await expect(
      waitForImageTask('task-1', { intervalMs: 0, timeoutMs: -1 }),
    ).rejects.toThrow(/timed out/)
  })
})
