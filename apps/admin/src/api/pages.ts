import type { Image, PaginateResult } from '~/models/base'
import type { PageModel } from '~/models/page'

import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface GetPagesParams {
  page?: number
  size?: number
}

export interface CreatePageData {
  content?: string
  contentFormat?: 'lexical' | 'markdown'
  draftId?: string
  images?: Image[]
  meta?: Record<string, unknown>
  order?: number
  slug: string
  subtitle?: string
  text: string
  title: string
}

export function getPages(params: GetPagesParams = {}) {
  return getJson<PaginateResult<PageModel>>('/pages', {
    page: params.page,
    size: params.size,
  })
}

export function getPageById(id: string) {
  return getJson<PageModel>(`/pages/${id}`)
}

export function createPage(data: CreatePageData) {
  return postJson<PageModel, CreatePageData>('/pages', data)
}

export function updatePage(id: string, data: Partial<CreatePageData>) {
  return putJson<PageModel, Partial<CreatePageData>>(`/pages/${id}`, data)
}

export function deletePage(id: string) {
  return deleteJson<void>(`/pages/${id}`)
}

export function reorderPages(seq: Array<{ id: string; order: number }>) {
  return patchJson<void, { seq: Array<{ id: string; order: number }> }>(
    '/pages/reorder',
    { seq },
  )
}
