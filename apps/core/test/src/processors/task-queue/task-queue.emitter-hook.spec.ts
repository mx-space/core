import { describe, expect, it, vi } from 'vitest'

import { TaskQueueService } from '~/processors/task-queue/task-queue.service'

/**
 * Step-6 smoke: createTask must emit exactly one 'created' phase carrying the
 * full Task snapshot via the injected TaskQueueEmitter, and MUST NOT emit when
 * the dedup-hit early return fires.
 */
describe('TaskQueueService — createTask emitter hook', () => {
  function buildHarness(
    opts: {
      dedupHit?: { existingId: string; existingStatus: string }
    } = {},
  ) {
    const pipeline = {
      hset: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      rpush: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }

    const dedupHit = opts.dedupHit
    const redis = {
      get: vi.fn().mockResolvedValue(dedupHit?.existingId ?? null),
      hgetall: vi.fn().mockResolvedValue(
        dedupHit
          ? {
              id: dedupHit.existingId,
              type: 'ai:summary',
              status: dedupHit.existingStatus,
              payload: '{}',
              payloadHash: 'h',
              groupId: '',
              scope: '',
              progress: '',
              progressMessage: '',
              totalItems: '',
              completedItems: '',
              tokensGenerated: '0',
              createdAt: '0',
              startedAt: '',
              completedAt: '',
              lastHeartbeat: '0',
              result: '',
              error: '',
              workerId: '',
              retryCount: '0',
              version: '1',
            }
          : {},
      ),
      lrange: vi.fn().mockResolvedValue([]),
      pipeline: vi.fn().mockReturnValue(pipeline),
    }

    const redisService = {
      getClient: () => redis as unknown,
      isReady: () => true,
      getStatus: () => 'ready',
      isUnavailableError: () => false,
    }

    const emitter = {
      emitCreated: vi.fn(),
      emitStarted: vi.fn(),
      emitStatus: vi.fn(),
      emitResult: vi.fn(),
      emitDeleted: vi.fn(),
      emitLog: vi.fn(),
      emitProgress: vi.fn(),
      emitStream: vi.fn(),
      dispose: vi.fn(),
    }

    const service = new TaskQueueService(redisService as any, emitter as any)

    return { service, emitter, redis, pipeline }
  }

  it('emits exactly one created phase with the full snapshot', async () => {
    const { service, emitter } = buildHarness()

    const { taskId, created } = await service.createTask({
      type: 'ai:summary',
      payload: { foo: 'bar' },
    })

    expect(created).toBe(true)
    expect(taskId).toBeTruthy()
    expect(emitter.emitCreated).toHaveBeenCalledTimes(1)

    const snapshot = emitter.emitCreated.mock.calls[0][0]
    expect(snapshot.id).toBe(taskId)
    expect(snapshot.type).toBe('ai:summary')
    expect(snapshot.status).toBe('pending')
    expect(snapshot.payload).toEqual({ foo: 'bar' })
    expect(snapshot.logs).toEqual([])
    expect(snapshot.retryCount).toBe(0)
  })

  it('does NOT emit when a dedup hit short-circuits createTask', async () => {
    const { service, emitter } = buildHarness({
      dedupHit: { existingId: 'existing-1', existingStatus: 'running' },
    })

    const result = await service.createTask({
      type: 'ai:summary',
      payload: { foo: 'bar' },
      dedupKey: 'k',
    })

    expect(result).toEqual({ taskId: 'existing-1', created: false })
    expect(emitter.emitCreated).not.toHaveBeenCalled()
  })
})
