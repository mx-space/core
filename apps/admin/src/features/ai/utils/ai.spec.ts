import { describe, expect, it } from 'vitest'

import type { AITask, AITaskLog, SubTaskStats } from '~/api/ai'
import { AITaskStatus, AITaskType } from '~/api/ai'

import {
  applyTaskPatch,
  prependTaskToList,
  removeTaskFromList,
  upsertTaskInList,
} from './ai'

// Spec 2 step-27 — pure-logic guards for the per-task patch merger and the
// list cache helpers. SocketBridge.spec.tsx covers integration; this file is
// the isolated immutability + ordering contract.

function makeTask(overrides: Partial<AITask> = {}): AITask {
  return {
    createdAt: 1_700_000_000_000,
    id: 'task-1',
    logs: [],
    payload: {},
    retryCount: 0,
    status: AITaskStatus.Pending,
    type: AITaskType.Summary,
    ...overrides,
  }
}

describe('applyTaskPatch', () => {
  it('returns identity when no patch and no log are given', () => {
    const prev = makeTask()
    expect(applyTaskPatch(prev)).toBe(prev)
  })

  it('returns identity for an empty patch with no log', () => {
    const prev = makeTask()
    // Empty patch should not produce a new object reference — saves React
    // re-renders downstream.
    expect(applyTaskPatch(prev, {})).toBe(prev)
  })

  it('ignores undefined patch fields without mutating prev', () => {
    const prev = makeTask({ progress: 25 })
    const result = applyTaskPatch(prev, { progress: undefined })
    expect(result).toBe(prev)
    expect(prev.progress).toBe(25)
  })

  it('immutably replaces patched fields and leaves prev untouched', () => {
    const prev = makeTask({ progress: 25, status: AITaskStatus.Running })
    const result = applyTaskPatch(prev, {
      progress: 75,
      progressMessage: 'doing thing',
    })
    expect(result).not.toBe(prev)
    expect(result.progress).toBe(75)
    expect(result.progressMessage).toBe('doing thing')
    expect(result.status).toBe(AITaskStatus.Running)
    // prev is untouched
    expect(prev.progress).toBe(25)
    expect(prev.progressMessage).toBeUndefined()
  })

  it('replaces subTaskStats wholesale (no delta merge)', () => {
    const prev = makeTask({
      subTaskStats: {
        completed: 1,
        failed: 0,
        pending: 4,
        running: 1,
        total: 6,
      },
    })
    const nextStats: SubTaskStats = {
      completed: 3,
      failed: 1,
      pending: 1,
      running: 1,
      total: 6,
    }
    const result = applyTaskPatch(prev, { subTaskStats: nextStats })
    // Wholesale replace — server guarantees full stats per spec 2 step-19.
    expect(result.subTaskStats).toBe(nextStats)
    expect(result.subTaskStats).not.toBe(prev.subTaskStats)
  })

  it('appends a log to a NEW logs array in order, preserving prior entries', () => {
    const a: AITaskLog = { level: 'info', message: 'a', timestamp: 1 }
    const b: AITaskLog = { level: 'warn', message: 'b', timestamp: 2 }
    const prev = makeTask({ logs: [a] })
    const result = applyTaskPatch(prev, undefined, b)
    expect(result.logs).toEqual([a, b])
    // New array, prev.logs not mutated
    expect(result.logs).not.toBe(prev.logs)
    expect(prev.logs).toEqual([a])
  })

  it('handles a missing prior logs array (treats as empty)', () => {
    const log: AITaskLog = { level: 'info', message: 'first', timestamp: 1 }
    const prev = makeTask()
    // happy-dom-friendly cast: simulate a snapshot without logs (defensive
    // for older fixtures)
    delete (prev as { logs?: unknown }).logs
    const result = applyTaskPatch(prev, undefined, log)
    expect(result.logs).toEqual([log])
  })

  it('applies patch + log together in one pass', () => {
    const prev = makeTask({ status: AITaskStatus.Pending, logs: [] })
    const log: AITaskLog = { level: 'info', message: 'started', timestamp: 1 }
    const result = applyTaskPatch(
      prev,
      { status: AITaskStatus.Running, startedAt: 42 },
      log,
    )
    expect(result.status).toBe(AITaskStatus.Running)
    expect(result.startedAt).toBe(42)
    expect(result.logs).toEqual([log])
  })

  it('forwards cost/tokensGenerated additive numeric fields', () => {
    const prev = makeTask()
    const result = applyTaskPatch(prev, { cost: 12, tokensGenerated: 345 })
    expect(result.cost).toBe(12)
    expect(result.tokensGenerated).toBe(345)
  })
})

describe('prependTaskToList', () => {
  it('prepends a new task and bumps total', () => {
    const a = makeTask({ id: 'a' })
    const b = makeTask({ id: 'b' })
    const list = { data: [a], total: 1 }
    const result = prependTaskToList(list, b) as {
      data: AITask[]
      total: number
    }
    expect(result.data.map((t) => t.id)).toEqual(['b', 'a'])
    expect(result.total).toBe(2)
  })

  it('upserts in place if the task is already present (no duplicate, no total bump)', () => {
    const a = makeTask({ id: 'a', progress: 10 })
    const list = { data: [a], total: 1 }
    const result = prependTaskToList(list, {
      ...a,
      progress: 99,
    }) as { data: AITask[]; total: number }
    expect(result.data.map((t) => t.id)).toEqual(['a'])
    expect(result.total).toBe(1)
    expect(result.data[0].progress).toBe(99)
  })

  it('passes through unrelated cache shapes unchanged', () => {
    const detailCache = makeTask({ id: 'x' })
    expect(prependTaskToList(detailCache, makeTask())).toBe(detailCache)
  })
})

describe('upsertTaskInList', () => {
  it('patches the matching id and returns a new array (immutable)', () => {
    const a = makeTask({ id: 'a', progress: 0 })
    const b = makeTask({ id: 'b', progress: 0 })
    const list = { data: [a, b], total: 2 }
    const result = upsertTaskInList(list, 'b', { progress: 80 }) as {
      data: AITask[]
      total: number
    }
    expect(result).not.toBe(list)
    expect(result.data).not.toBe(list.data)
    expect(result.data[1].progress).toBe(80)
    // prev untouched
    expect(list.data[1].progress).toBe(0)
  })

  it('returns identity when id is absent', () => {
    const a = makeTask({ id: 'a' })
    const list = { data: [a], total: 1 }
    expect(upsertTaskInList(list, 'missing', { progress: 1 })).toBe(list)
  })

  it('returns identity when the patch produces no change', () => {
    const a = makeTask({ id: 'a' })
    const list = { data: [a], total: 1 }
    expect(upsertTaskInList(list, 'a', {})).toBe(list)
  })
})

describe('removeTaskFromList', () => {
  it('removes the matching id and decrements total', () => {
    const a = makeTask({ id: 'a' })
    const b = makeTask({ id: 'b' })
    const list = { data: [a, b], total: 2 }
    const result = removeTaskFromList(list, 'a') as {
      data: AITask[]
      total: number
    }
    expect(result.data.map((t) => t.id)).toEqual(['b'])
    expect(result.total).toBe(1)
  })

  it('returns identity when id is absent', () => {
    const a = makeTask({ id: 'a' })
    const list = { data: [a], total: 1 }
    expect(removeTaskFromList(list, 'missing')).toBe(list)
  })

  it('clamps total at 0 (never negative)', () => {
    const a = makeTask({ id: 'a' })
    const list = { data: [a], total: 0 }
    const result = removeTaskFromList(list, 'a') as {
      data: AITask[]
      total: number
    }
    expect(result.total).toBe(0)
  })
})
