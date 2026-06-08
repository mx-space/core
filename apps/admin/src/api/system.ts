import { API_URL } from '~/constants/env'
import type { AppInfo } from '~/models/system'

import {
  buildAdminRequestHeaders,
  getJson,
  patchJson,
  postJson,
  requestJson,
} from './http'

export interface CreateOwnerData {
  avatar?: string
  introduce?: string
  mail: string
  name?: string
  password: string
  url?: string
  username: string
}

export interface InitDefaultConfigs {
  seo?: {
    description?: string
    keywords?: string[]
    title?: string
  }
}

export async function checkInit() {
  try {
    const response = await fetch(`${API_URL}/init`, {
      credentials: 'include',
      headers: buildAdminRequestHeaders(),
    })

    if (response.status === 404 || response.status === 403) {
      return { isInit: true }
    }

    if (!response.ok)
      throw new Error(response.statusText || 'Init check failed')

    return (await response.json()) as { isInit: boolean }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Init check failed', { cause: error })
  }
}

export function getAppInfo() {
  return getJson<AppInfo>('/info')
}

export function getInitDefaultConfigs() {
  return getJson<InitDefaultConfigs>('/init/configs/default')
}

export function patchInitConfig<TData>(key: string, data: TData) {
  return patchJson<void, TData>(`/init/configs/${key}`, data)
}

export function restoreFromBackup(formData: FormData) {
  return requestJson<void>('/init/restore', {
    body: formData,
    method: 'POST',
  })
}

export function createOwner(data: CreateOwnerData) {
  return postJson<void, CreateOwnerData>('/init/owner', data)
}

export function callBuiltInFunction<TResponse = unknown>(
  name: string,
  params?: Record<string, boolean | number | string | undefined>,
) {
  return getJson<TResponse>(`/fn/built-in/${name}`, params)
}
