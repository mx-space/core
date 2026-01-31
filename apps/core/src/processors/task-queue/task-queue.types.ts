export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface TaskLog {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface TaskRedis {
  id: string
  type: string
  status: string
  payload: string
  payloadHash: string
  groupId: string

  progress: string
  progressMessage: string
  totalItems: string
  completedItems: string

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

  progress?: number
  progressMessage?: string
  totalItems?: number
  completedItems?: number

  createdAt: number
  startedAt?: number
  completedAt?: number

  result?: TResult
  error?: string
  logs: TaskLog[]

  workerId?: string
  retryCount: number
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
  appendLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
  ) => Promise<void>
  setResult: (result: unknown) => Promise<void>
  isAborted: () => boolean
}

export interface TaskHandler<TPayload = Record<string, unknown>> {
  type: string
  execute: (payload: TPayload, context: TaskExecuteContext) => Promise<void>
}

export function parseTask(raw: TaskRedis, logs: string[]): Task {
  return {
    id: raw.id,
    type: raw.type,
    status: raw.status as TaskStatus,
    payload: JSON.parse(raw.payload || '{}'),
    groupId: raw.groupId || undefined,
    progress: raw.progress ? Number(raw.progress) : undefined,
    progressMessage: raw.progressMessage || undefined,
    totalItems: raw.totalItems ? Number(raw.totalItems) : undefined,
    completedItems: raw.completedItems ? Number(raw.completedItems) : undefined,
    createdAt: Number(raw.createdAt),
    startedAt: raw.startedAt ? Number(raw.startedAt) : undefined,
    completedAt: raw.completedAt ? Number(raw.completedAt) : undefined,
    result: raw.result ? JSON.parse(raw.result) : undefined,
    error: raw.error || undefined,
    logs: logs.map((l) => JSON.parse(l) as TaskLog),
    workerId: raw.workerId || undefined,
    retryCount: Number(raw.retryCount || '0'),
  }
}
