import { deleteJson, getJson, patchJson } from './http'

export const SubscribePostCreateBit = 1
export const SubscribeNoteCreateBit = 2
export const SubscribeSayCreateBit = 4
export const SubscribeRecentCreateBit = 8

export interface Subscriber {
  cancelToken: string
  createdAt: string
  email: string
  id: string
  subscribe: number
  verified: boolean
}

export interface SubscribeResponse {
  data: Subscriber[]
  pagination: {
    currentPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
    size: number
    total: number
    totalPage: number
  }
}

export function getSubscribeStatus() {
  return getJson<{ enable: boolean }>('/subscribe/status')
}

export function getSubscribers(params: { page: number; size: number }) {
  return getJson<SubscribeResponse>('/subscribe', {
    page: params.page,
    size: params.size,
  })
}

export function updateSubscribeEnabled(enabled: boolean) {
  return patchJson<void, { emailSubscribe: boolean }>('/options/featureList', {
    emailSubscribe: enabled,
  })
}

export function unsubscribeBatch(params: { all: true } | { emails: string[] }) {
  return deleteJson<{ deletedCount: number }, typeof params>(
    '/subscribe/unsubscribe/batch',
    params,
  )
}
