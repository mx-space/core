import { TaskQueueProcessor } from '~/processors/task-queue/task-queue.processor'
import { TaskQueueRecovery } from '~/processors/task-queue/task-queue.recovery'
import { describe, expect, it, vi } from 'vitest'

describe('Task queue bootstrap', () => {
  it('skips polling until redis is ready', async () => {
    const taskService = {
      isRedisReady: vi.fn(() => false),
      getRedisStatus: vi.fn(() => 'connecting'),
      isRedisUnavailableError: vi.fn(() => true),
      acquireTask: vi.fn(),
    }

    const processor = new TaskQueueProcessor(taskService as any)
    const warnSpy = vi
      .spyOn((processor as any).logger, 'warn')
      .mockImplementation(() => undefined)

    ;(processor as any).isRunning = true
    await (processor as any).poll()
    processor.stop()

    expect(taskService.acquireTask).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      JSON.stringify({
        module: 'TaskQueueProcessor',
        message: 'Task processor waiting for Redis connection',
        redisStatus: 'connecting',
      }),
    )
  })

  it('skips recovery until redis is ready', async () => {
    const taskService = {
      isRedisReady: vi.fn(() => false),
      getRedisStatus: vi.fn(() => 'connecting'),
      isRedisUnavailableError: vi.fn(() => true),
      recoverStaleTasks: vi.fn(),
    }

    const recovery = new TaskQueueRecovery(taskService as any)
    const warnSpy = vi
      .spyOn((recovery as any).logger, 'warn')
      .mockImplementation(() => undefined)

    await (recovery as any).recover()

    expect(taskService.recoverStaleTasks).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      JSON.stringify({
        module: 'TaskQueueRecovery',
        message: 'Task recovery waiting for Redis connection',
        redisStatus: 'connecting',
      }),
    )
  })
})
