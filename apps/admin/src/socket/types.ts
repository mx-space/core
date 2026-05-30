import type { AITask, AITaskLog } from '~/api/ai'

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

  // AI Task Queue realtime fan-out (spec 2). Hand-duplicated from
  // apps/core/src/constants/business-event.constant.ts — no monorepo import.
  AI_TASK_UPDATE = 'AI_TASK_UPDATE',
}

/**
 * Frozen phase union for AI_TASK_UPDATE — verbatim mirror of the server-side
 * AiTaskUpdatePhase declared in
 * apps/core/src/processors/task-queue/task-queue.types.ts. Keep in sync by
 * hand; there is intentionally no cross-package import.
 */
export type AiTaskUpdatePhase =
  | 'created'
  | 'started'
  | 'progress'
  | 'status'
  | 'log'
  | 'result'
  | 'stream'
  | 'deleted'

export interface AiTaskUpdateStreamFrame {
  lang?: string
  segmentId?: string
  chunk?: string
  partial?: unknown
  done?: boolean
}

interface AiTaskUpdatePayloadBase {
  id: string
  type: string
  groupId?: string
  log?: AITaskLog
  stream?: AiTaskUpdateStreamFrame
  result?: unknown
}

export type AiTaskUpdatePayload =
  | (AiTaskUpdatePayloadBase & {
      phase: 'created'
      // On 'created', patch is the FULL task snapshot.
      patch: AITask
    })
  | (AiTaskUpdatePayloadBase & {
      phase: Exclude<AiTaskUpdatePhase, 'created'>
      // On all other phases, patch is a partial diff (or omitted entirely).
      patch?: Partial<AITask>
    })

export type NotificationTypes = 'error' | 'info' | 'success' | 'warn'
