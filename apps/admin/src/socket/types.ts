import type { AITask, AITaskLog } from '~/api/tasks'

export enum EventTypes {
  GATEWAY_CONNECT = 'gateway.connect',
  GATEWAY_DISCONNECT = 'gateway.disconnect',

  VISITOR_ONLINE = 'visitor.online',
  VISITOR_OFFLINE = 'visitor.offline',

  AUTH_FAILED = 'auth.failed',

  COMMENT_CREATE = 'comment.create',

  POST_CREATE = 'post.create',
  POST_UPDATE = 'post.update',
  POST_DELETE = 'post.delete',

  NOTE_CREATE = 'note.create',
  NOTE_UPDATE = 'note.update',
  NOTE_DELETE = 'note.delete',

  PAGE_UPDATED = 'PAGE_UPDATED',

  SAY_CREATE = 'say.create',
  SAY_DELETE = 'say.delete',
  SAY_UPDATE = 'say.update',

  LINK_APPLY = 'link.apply',

  DANMAKU_CREATE = 'DANMAKU_CREATE',
  CONTENT_REFRESH = 'content.refresh',

  IMAGE_REFRESH = 'image.refresh',
  IMAGE_FETCH = 'image.fetch',

  ADMIN_NOTIFICATION = 'admin.notification',

  // Unified Task Queue realtime fan-out. Hand-duplicated from
  // apps/core/src/constants/business-event.constant.ts — no monorepo import.
  TASK_UPDATE = 'task.update',
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
