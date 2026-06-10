import { getJson, requestJson } from './http'
import type { CreateTaskResponse } from './tasks'

export type { CreateTaskResponse }

export enum CronTaskType {
  CleanAccessRecord = 'cron:clean-access-record',
  CleanCommentUploads = 'cron:clean-comment-uploads',
  CleanTempDirectory = 'cron:clean-temp-directory',
  DeleteExpiredJWT = 'cron:delete-expired-jwt',
  PushToBaiduSearch = 'cron:push-to-baidu-search',
  PushToBingSearch = 'cron:push-to-bing-search',
  RebuildSearchIndex = 'cron:rebuild-search-index',
  ResetIPAccess = 'cron:reset-ip-access',
  ResetLikedOrReadArticleRecord = 'cron:reset-liked-or-read',
}

export enum CronTaskStatus {
  Cancelled = 'cancelled',
  Completed = 'completed',
  Failed = 'failed',
  PartialFailed = 'partial_failed',
  Pending = 'pending',
  Running = 'running',
}

export interface CronTaskDefinition {
  cronExpression: string
  description: string
  lastDate?: string | null
  name: string
  nextDate?: string | null
  type: CronTaskType
}

export interface CronTaskLog {
  level: 'error' | 'info' | 'warn'
  message: string
  timestamp: number
}

export interface CronTask {
  completedAt?: number
  createdAt: number
  error?: string
  id: string
  logs: CronTaskLog[]
  payload: Record<string, unknown>
  progress?: number
  progressMessage?: string
  result?: unknown
  retryCount: number
  startedAt?: number
  status: CronTaskStatus
  type: CronTaskType
  workerId?: string
}

export interface CronTasksResponse {
  data: CronTask[]
  total: number
}

export interface CronTaskFilters {
  page?: number
  size?: number
  status?: CronTaskStatus
  type?: CronTaskType
}

export function getCronTaskDefinitions() {
  return getJson<CronTaskDefinition[]>('/cron-task')
}

export function runCronTask(type: CronTaskType) {
  return requestJson<CreateTaskResponse>(`/cron-task/run/${type}`, {
    method: 'POST',
  })
}
