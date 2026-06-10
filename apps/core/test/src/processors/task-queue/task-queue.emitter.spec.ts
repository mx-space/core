import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import {
  aiTaskRooms,
  TaskQueueEmitter,
} from '~/processors/task-queue/task-queue.emitter'

/**
 * Pure-logic verification of TaskQueueEmitter — no Nest app, no Redis. Asserts:
 *   - 1s timer rule
 *   - 5 percentage-point delta rule
 *   - progress === 100 immediate shortcut
 *   - per-phase room targeting (status / stream / progress all route correctly)
 *   - stream phase NEVER targets the group room (groupId is informational)
 *   - dispose clears timers AND is idempotent
 */
describe('TaskQueueEmitter', () => {
  function makeHarness() {
    const calls: Array<{
      event: BusinessEvents
      payload: any
      room: string
    }> = []
    const eventManager = {
      emitToAdminRoom: vi.fn(
        async (event: BusinessEvents, payload: unknown, room: string) => {
          calls.push({ event, payload: payload as any, room })
        },
      ),
    }
    const emitter = new TaskQueueEmitter(eventManager as any)
    return { emitter, eventManager, calls }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('throttle — progress emits', () => {
    it('progress 0→4 within 100ms does NOT emit (no rule satisfied)', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T1', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 0 })
      // first emit always fires (dueByTime: now - 0 >= 1000ms)
      expect(calls.length).toBe(1)

      // advance 100ms < timer threshold AND delta (4-0=4 < 5) NOT met
      vi.advanceTimersByTime(100)
      emitter.emitProgress(meta, { progress: 4 })
      // pending stash + scheduled trailing timer, but NO new flush yet
      expect(calls.length).toBe(1)
    })

    it('progress 0→6 within 100ms emits (5pp delta rule)', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T2', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 0 })
      expect(calls.length).toBe(1)

      vi.advanceTimersByTime(100)
      emitter.emitProgress(meta, { progress: 6 })
      // 6 - 0 = 6 >= 5pp ⇒ immediate flush
      expect(calls.length).toBe(2)
      expect((calls[1].payload as any).patch.progress).toBe(6)
    })

    it('progress 50 then 51 after 1100ms emits (timer rule)', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T3', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 50 })
      expect(calls.length).toBe(1)

      vi.advanceTimersByTime(1100)
      emitter.emitProgress(meta, { progress: 51 })
      // delta = 1 < 5pp BUT 1100ms >= 1000ms timer ⇒ immediate flush
      expect(calls.length).toBe(2)
      expect((calls[1].payload as any).patch.progress).toBe(51)
    })

    it('progress 99→100 emits immediately (completion shortcut)', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T4', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 99 })
      expect(calls.length).toBe(1)

      // immediate follow-up with progress=100 — no time advance, delta only 1
      emitter.emitProgress(meta, { progress: 100 })
      expect(calls.length).toBe(2)
      expect((calls[1].payload as any).patch.progress).toBe(100)
    })

    it('pending payload flushes after trailing timer fires', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T5', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 0 })
      expect(calls.length).toBe(1)

      vi.advanceTimersByTime(100)
      emitter.emitProgress(meta, { progress: 3 })
      // stash only; no new emit
      expect(calls.length).toBe(1)

      // advance to schedule fire — initial timer was scheduled at t=100 with
      // wait = 1000 - (100 - 0) = 900 ⇒ fires at t=1000
      vi.advanceTimersByTime(900)
      expect(calls.length).toBe(2)
      expect((calls[1].payload as any).patch.progress).toBe(3)
    })
  })

  describe('scope in payload', () => {
    it('carries scope on lifecycle, log, stream, and progress payloads', () => {
      const { emitter, calls } = makeHarness()
      const meta = {
        id: 'S1',
        type: 'cron:run',
        scope: 'cron',
        groupId: 'G9',
      }

      emitter.emitStatus(meta, { status: 'running' as any })
      emitter.emitLog(meta, { timestamp: 0, level: 'info', message: 'x' })
      emitter.emitStream(meta, { chunk: 'c' })
      emitter.emitProgress(meta, { progress: 0 })

      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) {
        expect((c.payload as any).scope).toBe('cron')
      }
    })

    it('created payload carries scope from the task snapshot', () => {
      const { emitter, calls } = makeHarness()
      emitter.emitCreated({
        id: 'S2',
        type: 'enrichment:embed',
        scope: 'enrichment',
        status: 'pending' as any,
        payload: {},
        createdAt: 0,
        logs: [],
        retryCount: 0,
      })
      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) {
        expect((c.payload as any).scope).toBe('enrichment')
      }
    })
  })

  describe('per-phase room targeting', () => {
    it('status phase fans out to list + detail + group when groupId present', () => {
      const { emitter, calls } = makeHarness()
      emitter.emitStatus(
        { id: 'T10', type: 'ai:translation', scope: 'ai', groupId: 'G1' },
        { status: 'running' as any },
      )
      const rooms = calls.map((c) => c.room)
      expect(rooms).toEqual([
        aiTaskRooms.list,
        aiTaskRooms.detail('T10'),
        aiTaskRooms.group('G1'),
      ])
      for (const c of calls) {
        expect(c.event).toBe(BusinessEvents.TASK_UPDATE)
      }
    })

    it('status phase skips group room when groupId absent', () => {
      const { emitter, calls } = makeHarness()
      emitter.emitStatus(
        { id: 'T11', type: 'ai:summary', scope: 'ai' },
        { status: 'completed' as any },
      )
      const rooms = calls.map((c) => c.room)
      expect(rooms).toEqual([aiTaskRooms.list, aiTaskRooms.detail('T11')])
    })

    it('progress phase routes ONLY to detail room (never list / never group)', () => {
      const { emitter, calls } = makeHarness()
      const meta = {
        id: 'T12',
        type: 'ai:translation',
        scope: 'ai',
        groupId: 'G2',
      }
      emitter.emitProgress(meta, { progress: 0 })
      expect(calls).toHaveLength(1)
      expect(calls[0].room).toBe(aiTaskRooms.detail('T12'))
    })

    it('stream phase NEVER targets group room — detail only', () => {
      const { emitter, calls } = makeHarness()
      const meta = {
        id: 'T13',
        type: 'ai:translation',
        scope: 'ai',
        groupId: 'G3',
      }
      emitter.emitStream(meta, { lang: 'en', chunk: 'hello' })
      expect(calls).toHaveLength(1)
      expect(calls[0].room).toBe(aiTaskRooms.detail('T13'))
      // explicitly assert no broadcast hit the group room
      expect(
        calls.find((c) => c.room === aiTaskRooms.group('G3')),
      ).toBeUndefined()
    })

    it('log phase routes ONLY to detail room', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T14', type: 'ai:summary', scope: 'ai', groupId: 'G4' }
      emitter.emitLog(meta, {
        timestamp: Date.now(),
        level: 'info',
        message: 'hi',
      })
      expect(calls).toHaveLength(1)
      expect(calls[0].room).toBe(aiTaskRooms.detail('T14'))
    })
  })

  describe('dispose', () => {
    it('clears pending throttle timer so no late emit fires', () => {
      const { emitter, calls } = makeHarness()
      const meta = { id: 'T20', type: 'ai:summary', scope: 'ai' }

      emitter.emitProgress(meta, { progress: 0 })
      expect(calls.length).toBe(1)

      vi.advanceTimersByTime(100)
      emitter.emitProgress(meta, { progress: 3 })
      // pending timer scheduled
      expect(calls.length).toBe(1)

      emitter.dispose('T20')
      // advance past the original 1000ms boundary — no orphan emit
      vi.advanceTimersByTime(2000)
      expect(calls.length).toBe(1)
    })

    it('is idempotent — second dispose is a no-op', () => {
      const { emitter } = makeHarness()
      emitter.emitProgress(
        { id: 'T21', type: 'ai:summary', scope: 'ai' },
        { progress: 0 },
      )
      expect(() => {
        emitter.dispose('T21')
        emitter.dispose('T21')
        emitter.dispose('does-not-exist')
      }).not.toThrow()
    })
  })
})
