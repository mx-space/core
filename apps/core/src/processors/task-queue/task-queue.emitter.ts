import { Injectable, Logger } from '@nestjs/common'

import { BusinessEvents } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import type {
  Task,
  TaskLog,
  TaskUpdatePayload,
  TaskUpdateStreamFrame,
} from './task-queue.types'

/**
 * Room name helpers — kept here so all callers funnel through one source of
 * truth. Mirrors the four room patterns the admin subscribes via
 * `ai-task:subscribe`: list / detail / group.
 */
export const aiTaskRooms = {
  list: 'ai-task:list',
  detail: (id: string) => `ai-task:detail:${id}`,
  group: (id: string) => `ai-task:group:${id}`,
} as const

const PROGRESS_THROTTLE_MS = 1000
const PROGRESS_DELTA_PCT = 5

interface ThrottleState {
  lastEmitAt: number
  lastEmitProgress: number
  pendingPayload?: TaskUpdatePayload
  pendingGroupId?: string
  timer?: NodeJS.Timeout
}

interface EmitTaskMeta {
  id: string
  type: string
  scope: string
  groupId?: string
}

/**
 * TaskQueueEmitter centralises every `TASK_UPDATE` fan-out so callers in
 * TaskQueueService / TaskQueueProcessor don't have to know room targeting or
 * throttle rules. All emits route through `EventManagerService.emitToAdminRoom`
 * which short-circuits when no admin pod holds the room.
 */
@Injectable()
export class TaskQueueEmitter {
  private readonly logger = new Logger(TaskQueueEmitter.name)
  private readonly throttle = new Map<string, ThrottleState>()

  constructor(private readonly eventManager: EventManagerService) {}

  emitCreated(task: Task): void {
    const payload: TaskUpdatePayload = {
      id: task.id,
      type: task.type,
      scope: task.scope ?? '',
      groupId: task.groupId,
      phase: 'created',
      patch: task,
    }
    this.broadcastLifecycle(payload)
  }

  emitStarted(meta: EmitTaskMeta, patch: Partial<Task>): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'started',
      patch,
    }
    this.broadcastLifecycle(payload)
  }

  emitStatus(meta: EmitTaskMeta, patch: Partial<Task>): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'status',
      patch,
    }
    this.broadcastLifecycle(payload)
  }

  emitResult(meta: EmitTaskMeta, patch: Partial<Task>, result: unknown): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'result',
      patch,
      result,
    }
    this.broadcastLifecycle(payload)
  }

  emitDeleted(meta: EmitTaskMeta): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'deleted',
    }
    this.broadcastLifecycle(payload)
  }

  emitLog(meta: EmitTaskMeta, log: TaskLog): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'log',
      log,
    }
    // Logs target detail room only — no group fanout, no throttle.
    void this.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      payload,
      aiTaskRooms.detail(meta.id),
    )
  }

  emitStream(meta: EmitTaskMeta, frame: TaskUpdateStreamFrame): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'stream',
      stream: frame,
    }
    // Stream phase NEVER targets the group room — groupId is informational.
    void this.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      payload,
      aiTaskRooms.detail(meta.id),
    )
  }

  /**
   * Progress emits throttle per-task. Emit immediately when any of:
   *   (a) progress === 100
   *   (b) progress - lastEmitProgress >= 5 percentage points
   *   (c) now - lastEmitAt >= 1000ms
   * Otherwise stash the latest payload and schedule a trailing emit.
   * Progress targets detail room only (never list / never group).
   */
  emitProgress(meta: EmitTaskMeta, patch: Partial<Task>): void {
    const payload: TaskUpdatePayload = {
      id: meta.id,
      type: meta.type,
      scope: meta.scope,
      groupId: meta.groupId,
      phase: 'progress',
      patch,
    }
    const state = this.throttle.get(meta.id) ?? {
      lastEmitAt: 0,
      lastEmitProgress: Number.NEGATIVE_INFINITY,
    }
    const progress = patch.progress ?? 0
    const now = Date.now()
    const dueByTime = now - state.lastEmitAt >= PROGRESS_THROTTLE_MS
    const dueByDelta = progress - state.lastEmitProgress >= PROGRESS_DELTA_PCT
    const dueByCompletion = progress >= 100

    if (dueByCompletion || dueByDelta || dueByTime) {
      this.flushProgress(meta.id, payload, state, now)
      return
    }

    state.pendingPayload = payload
    state.pendingGroupId = meta.groupId
    if (!state.timer) {
      const wait = Math.max(0, PROGRESS_THROTTLE_MS - (now - state.lastEmitAt))
      state.timer = setTimeout(() => {
        const current = this.throttle.get(meta.id)
        if (!current?.pendingPayload) return
        const pending = current.pendingPayload
        current.timer = undefined
        current.pendingPayload = undefined
        this.flushProgress(meta.id, pending, current, Date.now())
      }, wait)
      if (typeof state.timer.unref === 'function') state.timer.unref()
    }
    this.throttle.set(meta.id, state)
  }

  /**
   * Drop any pending throttle timer / state for a task. Idempotent — safe to
   * call from processor finally, cancel pending branch, deleteTask, recovery.
   */
  dispose(taskId: string): void {
    const state = this.throttle.get(taskId)
    if (!state) return
    if (state.timer) clearTimeout(state.timer)
    this.throttle.delete(taskId)
  }

  private flushProgress(
    taskId: string,
    payload: TaskUpdatePayload,
    state: ThrottleState,
    now: number,
  ): void {
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = undefined
    }
    state.pendingPayload = undefined
    state.pendingGroupId = undefined
    state.lastEmitAt = now
    state.lastEmitProgress =
      payload.phase === 'progress' ? (payload.patch?.progress ?? 0) : 0
    this.throttle.set(taskId, state)
    void this.eventManager.emitToAdminRoom(
      BusinessEvents.TASK_UPDATE,
      payload,
      aiTaskRooms.detail(taskId),
    )
  }

  /**
   * Lifecycle phases (created/started/status/result/deleted) fan out to:
   *   - the list room (admin AI task list)
   *   - the detail room (single-task pane)
   *   - the group room (if groupId present)
   */
  private broadcastLifecycle(payload: TaskUpdatePayload): void {
    const rooms: string[] = [aiTaskRooms.list, aiTaskRooms.detail(payload.id)]
    if (payload.groupId) rooms.push(aiTaskRooms.group(payload.groupId))
    for (const room of rooms) {
      void this.eventManager.emitToAdminRoom(
        BusinessEvents.TASK_UPDATE,
        payload,
        room,
      )
    }
  }
}
