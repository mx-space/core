import type { CreateTaskOptions } from './task-queue.service'

export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  PartialFailed = 'partial_failed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface TaskLog {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface SubTaskStats {
  total: number
  completed: number
  partialFailed: number
  failed: number
  running: number
  pending: number
}

export interface TaskRedis {
  id: string
  type: string
  status: string
  payload: string
  payloadHash: string
  groupId: string
  scope: string

  progress: string
  progressMessage: string
  totalItems: string
  completedItems: string
  tokensGenerated: string
  // Optional — old task hashes from pre-spec-2 do not have this field.
  // Stored as integer cents string via HINCRBY. parseTask exposes USD float.
  totalCost?: string

  createdAt: string
  startedAt: string
  completedAt: string
  lastHeartbeat: string

  result: string
  error: string

  workerId: string
  retryCount: string
  version: string
}

export interface Task<TPayload = Record<string, unknown>, TResult = unknown> {
  id: string
  type: string
  status: TaskStatus
  payload: TPayload
  groupId?: string
  scope?: string

  progress?: number
  progressMessage?: string
  totalItems?: number
  completedItems?: number
  tokensGenerated?: number
  // USD float (cents/100). Undefined when pre-spec-2 task hash lacks the field.
  totalCost?: number

  createdAt: number
  startedAt?: number
  completedAt?: number

  result?: TResult
  error?: string
  logs: TaskLog[]

  workerId?: string
  retryCount: number

  // For batch tasks: sub-task statistics
  subTaskStats?: SubTaskStats
}

export interface TaskExecuteContext {
  taskId: string
  signal: AbortSignal
  updateProgress: (
    progress: number,
    message?: string,
    completed?: number,
    total?: number,
  ) => Promise<void>
  incrementTokens: (count?: number) => Promise<void>
  incrementCost: (usd: number) => Promise<void>
  appendLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
  ) => Promise<void>
  setResult: (result: unknown) => Promise<void>
  setStatus: (status: TaskStatus) => void
  isAborted: () => boolean
  /**
   * Sync push of a stream frame for this task. The TaskStreamBuffer behind
   * this closure coalesces calls (200ms idle / 80-char threshold) and routes
   * the resulting frame through `TaskQueueEmitter.emitStream`. When the task
   * has no groupId (e.g. markdown summary), emit still targets the detail
   * room ONLY — groupId is informational and never routes the stream phase.
   */
  streamPusher: (event: {
    lang?: string
    segmentId?: string
    chunk?: string
    partial?: unknown
    done?: boolean
  }) => void
}

export interface TaskHandler<TPayload = Record<string, unknown>> {
  type: string
  execute: (payload: TPayload, context: TaskExecuteContext) => Promise<void>
  buildRetryTask?: (
    task: Task,
  ) => CreateTaskOptions | Promise<CreateTaskOptions>
}

/**
 * Frozen phase union for TASK_UPDATE realtime fan-out (spec 2).
 * Adding a new phase is a wire-contract break — admin EventTypes mirror must
 * also be updated in apps/admin/src/socket/types.ts.
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
  log?: TaskLog
  stream?: TaskUpdateStreamFrame
  result?: unknown
}

export type TaskUpdatePayload =
  | (TaskUpdatePayloadBase & {
      phase: 'created'
      // On 'created', patch is the FULL task snapshot.
      patch: Task
    })
  | (TaskUpdatePayloadBase & {
      phase: Exclude<TaskUpdatePhase, 'created'>
      // On all other phases, patch is a partial diff (or omitted entirely).
      patch?: Partial<Task>
    })

const optionalNumber = (raw: string): number | undefined =>
  raw ? Number(raw) : undefined
const optionalString = (raw: string): string | undefined => raw || undefined

function parseJsonOr<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function parseTask(raw: TaskRedis, logs: string[]): Task {
  // Defensive: pre-spec-2 task hashes have no `totalCost` field. Guard against
  // empty string / undefined / NaN — only expose USD float when cents>0.
  const cents = Number(raw.totalCost)
  const totalCost =
    Number.isFinite(cents) && cents > 0 ? cents / 100 : undefined
  return {
    id: raw.id,
    type: raw.type,
    status: raw.status as TaskStatus,
    payload: parseJsonOr(raw.payload, {}),
    groupId: optionalString(raw.groupId),
    scope: optionalString(raw.scope),
    progress: optionalNumber(raw.progress),
    progressMessage: optionalString(raw.progressMessage),
    totalItems: optionalNumber(raw.totalItems),
    completedItems: optionalNumber(raw.completedItems),
    tokensGenerated: optionalNumber(raw.tokensGenerated),
    totalCost,
    createdAt: Number(raw.createdAt),
    startedAt: optionalNumber(raw.startedAt),
    completedAt: optionalNumber(raw.completedAt),
    result: parseJsonOr(raw.result, undefined),
    error: optionalString(raw.error),
    logs: logs
      .map((l) => parseJsonOr<TaskLog | null>(l, null))
      .filter((l): l is TaskLog => l !== null),
    workerId: optionalString(raw.workerId),
    retryCount: Number(raw.retryCount || '0'),
  }
}
