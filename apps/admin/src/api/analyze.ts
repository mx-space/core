import type { UA } from '~/models/analyze'
import type { PaginateResult } from '~/models/base'

import { deleteJson, getJson } from './http'

export type AnalyzeRecord = UA.Root & {
  country?: null | string
  referer?: null | string
}

export interface IPAggregate {
  months: Array<{
    date: string
    key: 'ip' | 'pv'
    value: number
  }>
  paths: Array<{
    count: number
    path: string
  }>
  today: Array<{
    hour: string
    key: 'ip' | 'pv'
    value: number
  }>
  todayIps: string[]
  total: {
    callTime: number
    uv: number
  }
  weeks: Array<{
    day: string
    key: 'ip' | 'pv'
    value: number
  }>
}

export interface GetAnalyzeParams {
  from?: string
  page?: number
  size?: number
  to?: string
}

export interface TrafficSourceResponse {
  categories: Array<{ name: string; value: number }>
  details: Array<{ count: number; source: string }>
}

export interface DeviceDistributionResponse {
  browsers: Array<{ name: string; value: number }>
  devices: Array<{ name: string; value: number }>
  os: Array<{ name: string; value: number }>
}

export function getAnalyzeList(params: GetAnalyzeParams = {}) {
  return getJson<PaginateResult<AnalyzeRecord>>('/analyze', {
    from: params.from,
    page: params.page,
    size: params.size,
    to: params.to,
  })
}

export function getAnalyzeAggregate() {
  return getJson<IPAggregate>('/analyze/aggregate')
}

export function getTrafficSource(params?: { from?: string; to?: string }) {
  return getJson<TrafficSourceResponse>('/analyze/traffic-source', {
    from: params?.from,
    to: params?.to,
  })
}

export function getDeviceDistribution(params?: { from?: string; to?: string }) {
  return getJson<DeviceDistributionResponse>('/analyze/device', {
    from: params?.from,
    to: params?.to,
  })
}

export function deleteAllAnalyzeRecords() {
  return deleteJson<void>('/analyze')
}
