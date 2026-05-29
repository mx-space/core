import { getJson } from './http'

export interface ServerlessLogEntry {
  createdAt: string
  error?: { message: string; name: string; stack?: string }
  executionTime: number
  functionId: string
  id: string
  ip: string
  logs?: Array<{ args: unknown[]; level: string; timestamp: number }>
  method: string
  name: string
  reference: string
  status: 'error' | 'success'
}

export interface ServerlessLogPagination {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
  size: number
  total: number
  totalPage: number
}

export interface ServerlessLogListResponse {
  data: ServerlessLogEntry[]
  pagination: ServerlessLogPagination
}

export interface GetServerlessLogsParams {
  page?: number
  size?: number
  status?: 'error' | 'success'
}

export function getInvocationLogs(
  id: string,
  params?: GetServerlessLogsParams,
) {
  return getJson<ServerlessLogListResponse>(
    `/fn/logs/${id}`,
    params
      ? {
          page: params.page,
          size: params.size,
          status: params.status,
        }
      : undefined,
  )
}

export function getInvocationLogDetail(id: string) {
  return getJson<ServerlessLogEntry>(`/fn/log/${id}`)
}

export function getCompiledCode(id: string) {
  return getJson<string>(`/fn/compiled/${id}`)
}
