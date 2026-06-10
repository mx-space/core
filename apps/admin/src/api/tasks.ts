import { deleteJson, getJson, requestJson } from './http'

export type TaskScope = 'ai' | 'cron' | 'enrichment'

export enum AITaskType {
  Summary = 'ai:summary',
  Translation = 'ai:translation',
  TranslationBatch = 'ai:translation:batch',
  TranslationAll = 'ai:translation:all',
  SlugBackfill = 'ai:slug:backfill',
  Insights = 'ai:insights',
  InsightsTranslation = 'ai:insights:translation',
}

export enum AITaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  PartialFailed = 'partial_failed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface AITaskLog {
  level: 'error' | 'info' | 'warn'
  message: string
  timestamp: number
}

export interface SubTaskStats {
  completed: number
  failed: number
  pending: number
  running: number
  total: number
}

export interface AITask {
  completedAt?: number
  completedItems?: number
  cost?: number
  createdAt: number
  error?: string
  groupId?: string
  id: string
  logs: AITaskLog[]
  payload: Record<string, unknown>
  progress?: number
  progressMessage?: string
  result?: unknown
  retryCount: number
  scope?: TaskScope
  startedAt?: number
  status: AITaskStatus
  subTaskStats?: SubTaskStats
  tokensGenerated?: number
  totalItems?: number
  type: AITaskType
  workerId?: string
}

export interface AITasksResponse {
  data: AITask[]
  total: number
}

export interface CreateTaskResponse {
  created: boolean
  taskId: string
}

interface TasksListWireResponse<T> {
  data: T[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export type TaskStatusValue = `${AITaskStatus}`

export interface GetTasksParams {
  includeSubTasks?: boolean
  page?: number
  scope?: TaskScope
  size?: number
  status?: TaskStatusValue | TaskStatusValue[]
  type?: AITaskType | string
}

export function getTasks<T = AITask>(params: GetTasksParams = {}) {
  return getJson<T[] | TasksListWireResponse<T>>('/tasks', {
    includeSubTasks: params.includeSubTasks,
    page: params.page,
    scope: params.scope,
    size: params.size,
    status: Array.isArray(params.status)
      ? params.status.join(',') || undefined
      : params.status,
    type: params.type,
  }).then(normalizeTasksResponse)
}

export function getTask(taskId: string) {
  return getJson<AITask>(`/tasks/${taskId}`)
}

export function retryTask(taskId: string) {
  return requestJson<CreateTaskResponse>(`/tasks/${taskId}/retry`, {
    method: 'POST',
  })
}

export function cancelTask(taskId: string) {
  return requestJson<{ success: boolean }>(`/tasks/${taskId}/cancel`, {
    method: 'POST',
  })
}

export function deleteTask(taskId: string) {
  return deleteJson<{ success: boolean }>(`/tasks/${taskId}`)
}

export function deleteTasks(params: {
  before: number
  scope?: TaskScope
  status?: TaskStatusValue
  type?: AITaskType | string
}) {
  const searchParams = new URLSearchParams()
  searchParams.set('before', String(params.before))
  if (params.status) searchParams.set('status', params.status)
  if (params.type) searchParams.set('type', params.type)
  if (params.scope) searchParams.set('scope', params.scope)

  return requestJson<{ deleted: number }>(`/tasks?${searchParams}`, {
    method: 'DELETE',
  })
}

export function getTasksByGroupId(groupId: string) {
  return getJson<AITask[]>(`/tasks/group/${groupId}`)
}

export function cancelTasksByGroupId(groupId: string) {
  return deleteJson<{ cancelled: number }>(`/tasks/group/${groupId}`)
}

function normalizeTasksResponse<T>(response: T[] | TasksListWireResponse<T>): {
  data: T[]
  total: number
} {
  if (Array.isArray(response)) {
    return {
      data: response,
      total: response.length,
    }
  }

  return {
    data: response.data,
    total: response.pagination?.total ?? response.data.length,
  }
}
