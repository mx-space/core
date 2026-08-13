import { describe, expect, it, vi } from 'vitest'

import { OperationContext } from '~/common/contexts/operation.context'
import { TaskQueueProcessor } from '~/processors/task-queue/task-queue.processor'
import { TaskStatus } from '~/processors/task-queue/task-queue.types'

function createHarness() {
  const taskService = {
    appendLog: vi.fn().mockResolvedValue(undefined),
    getTask: vi.fn(async (taskId: string) => ({
      id: taskId,
      type: 'probe',
      status: TaskStatus.Running,
      payload: { taskId },
      retryCount: 0,
    })),
    incrementCost: vi.fn().mockResolvedValue(undefined),
    incrementTokens: vi.fn().mockResolvedValue(undefined),
    isTaskCancelled: vi.fn().mockResolvedValue(false),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    renewLock: vi.fn().mockResolvedValue(true),
    setResult: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  }
  const emitter = {
    dispose: vi.fn(),
    emitStream: vi.fn(),
  }
  return {
    processor: new TaskQueueProcessor(taskService as never, emitter as never),
    taskService,
  }
}

describe('TaskQueueProcessor operation context', () => {
  it('keeps the task id stable across the full async handler', async () => {
    const { processor } = createHarness()
    const observed: Array<string | undefined> = []
    processor.registerHandler({
      type: 'probe',
      execute: async () => {
        observed.push(OperationContext.currentId())
        await Promise.resolve()
        observed.push(OperationContext.currentId())
      },
    })

    await (
      processor as unknown as { processTask: (id: string) => Promise<void> }
    ).processTask('task-1')

    expect(observed).toEqual(['task:task-1', 'task:task-1'])
    expect(OperationContext.currentId()).toBeUndefined()
  })

  it('isolates concurrent task handlers', async () => {
    const { processor } = createHarness()
    const observed = new Map<string, Array<string | undefined>>()
    processor.registerHandler<{ taskId: string }>({
      type: 'probe',
      execute: async ({ taskId }) => {
        const values = [OperationContext.currentId()]
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        values.push(OperationContext.currentId())
        observed.set(taskId, values)
      },
    })

    const processTask = (
      processor as unknown as { processTask: (id: string) => Promise<void> }
    ).processTask.bind(processor)
    await Promise.all([processTask('task-1'), processTask('task-2')])

    expect(observed.get('task-1')).toEqual(['task:task-1', 'task:task-1'])
    expect(observed.get('task-2')).toEqual(['task:task-2', 'task:task-2'])
  })
})
