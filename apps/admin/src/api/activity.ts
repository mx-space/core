import type { ActivityReadDurationType } from '../models/activity'
import type { PaginateResult } from '../models/base'

import { getJson } from './http'

export enum ActivityType {
  Like = 0,
  ReadDuration = 1,
}

export interface ActivityItem {
  createdAt: string
  id: string
  payload: {
    id?: string
    ip?: string
    [key: string]: unknown
  }
  ref?: {
    id?: string
    slug?: string
    title?: string
  }
  refId?: string
  type: ActivityType
}

export interface ActivityListResponse extends PaginateResult<
  ActivityItem | ActivityReadDurationType
> {
  objects?: {
    notes?: Array<{ id: string; title?: string }>
    pages?: Array<{ id: string; title?: string }>
    posts?: Array<{ id: string; title?: string }>
    recentlies?: Array<{ id: string; title?: string }>
  }
}

export interface ReadingRankItem {
  count: number
  ref: {
    id?: string
    nid?: number
    slug?: string
    title?: string
  }
  refId: string
}

export function getActivityList(params: {
  page?: number
  size?: number
  type?: ActivityType
}) {
  return getJson<ActivityListResponse>('/activity', params)
}

export function getReadingRank(params?: {
  end?: number
  limit?: number
  start?: number
}) {
  return getJson<ReadingRankItem[]>('/activity/reading/rank', params)
}

export function getTopReadings(params?: { days?: number; top?: number }) {
  return getJson<ReadingRankItem[]>('/activity/reading/top', params)
}

export function getReferenceUrl(id: string) {
  return getJson<string | null>(`/helper/url-builder/${id}`)
}
