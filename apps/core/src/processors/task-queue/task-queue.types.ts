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
}

/**
 * Frozen phase union for AI_TASK_UPDATE realtime fan-out (spec 2).
 * Adding a new phase is a wire-contract break — admin EventTypes mirror must
 * also be updated in apps/admin/src/socket/types.ts.
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
  log?: TaskLog
  stream?: AiTaskUpdateStreamFrame
  result?: unknown
}

export type AiTaskUpdatePayload =
  | (AiTaskUpdatePayloadBase & {
      phase: 'created'
      // On 'created', patch is the FULL task snapshot.
      patch: Task
    })
  | (AiTaskUpdatePayloadBase & {
      phase: Exclude<AiTaskUpdatePhase, 'created'>
      // On all other phases, patch is a partial diff (or omitted entirely).
      patch?: Partial<Task>
    })

const optionalNumber = (raw: string): number | undefined =>
  raw ? Number(raw) : undefined
const optionalString = (raw: string): string | undefined => raw || undefined

export function parseTask(raw: TaskRedis, logs: string[]): Task {
  return {
    id: raw.id,
    type: raw.type,
    status: raw.status as TaskStatus,
    payload: JSON.parse(raw.payload || '{}'),
    groupId: optionalString(raw.groupId),
    scope: optionalString(raw.scope),
    progress: optionalNumber(raw.progress),
    progressMessage: optionalString(raw.progressMessage),
    totalItems: optionalNumber(raw.totalItems),
    completedItems: optionalNumber(raw.completedItems),
    tokensGenerated: optionalNumber(raw.tokensGenerated),
    createdAt: Number(raw.createdAt),
    startedAt: optionalNumber(raw.startedAt),
    completedAt: optionalNumber(raw.completedAt),
    result: raw.result ? JSON.parse(raw.result) : undefined,
    error: optionalString(raw.error),
    logs: logs.map((l) => JSON.parse(l) as TaskLog),
    workerId: optionalString(raw.workerId),
    retryCount: Number(raw.retryCount || '0'),
  }
}
