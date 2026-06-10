import type { AITask, AITaskLog } from '~/api/tasks'

export enum EventTypes {
  GATEWAY_CONNECT = 'GATEWAY_CONNECT',
  GATEWAY_DISCONNECT = 'GATEWAY_DISCONNECT',

  VISITOR_ONLINE = 'VISITOR_ONLINE',
  VISITOR_OFFLINE = 'VISITOR_OFFLINE',

  AUTH_FAILED = 'AUTH_FAILED',

  COMMENT_CREATE = 'COMMENT_CREATE',

  POST_CREATE = 'POST_CREATE',
  POST_UPDATE = 'POST_UPDATE',
  POST_DELETE = 'POST_DELETE',

  NOTE_CREATE = 'NOTE_CREATE',
  NOTE_UPDATE = 'NOTE_UPDATE',
  NOTE_DELETE = 'NOTE_DELETE',

  PAGE_UPDATED = 'PAGE_UPDATED',

  SAY_CREATE = 'SAY_CREATE',
  SAY_DELETE = 'SAY_DELETE',
  SAY_UPDATE = 'SAY_UPDATE',

  LINK_APPLY = 'LINK_APPLY',

  DANMAKU_CREATE = 'DANMAKU_CREATE',
  CONTENT_REFRESH = 'CONTENT_REFRESH',

  IMAGE_REFRESH = 'IMAGE_REFRESH',
  IMAGE_FETCH = 'IMAGE_FETCH',

  ADMIN_NOTIFICATION = 'ADMIN_NOTIFICATION',

  // Unified Task Queue realtime fan-out. Hand-duplicated from
  // apps/core/src/constants/business-event.constant.ts — no monorepo import.
  TASK_UPDATE = 'TASK_UPDATE',
}

/**
 * Frozen phase union for TASK_UPDATE — verbatim mirror of the server-side
 * TaskUpdatePhase declared in
 * apps/core/src/processors/task-queue/task-queue.types.ts. Keep in sync by
 * hand; there is intentionally no cross-package import.
 */
export type TaskUpdatePhase =
  | 'created'
  | 'started'
  | 'progress'
  | 'status'
  | 'log'
  | 'result'
  | 'stream'
  | 'deleted'

export interface TaskUpdateStreamFrame {
  lang?: string
  segmentId?: string
  chunk?: string
  partial?: unknown
  done?: boolean
}

interface TaskUpdatePayloadBase {
  id: string
  type: string
  scope: string
  groupId?: string
  log?: AITaskLog
  stream?: TaskUpdateStreamFrame
  result?: unknown
}

export type TaskUpdatePayload =
  | (TaskUpdatePayloadBase & {
      phase: 'created'
      // On 'created', patch is the FULL task snapshot.
      patch: AITask
    })
  | (TaskUpdatePayloadBase & {
      phase: Exclude<TaskUpdatePhase, 'created'>
      // On all other phases, patch is a partial diff (or omitted entirely).
      patch?: Partial<AITask>
    })

export type NotificationTypes = 'error' | 'info' | 'success' | 'warn'
