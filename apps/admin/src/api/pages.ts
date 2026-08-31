import type { PaginateResult } from '~/models/base'
import type { PageModel } from '~/models/page'

import { deleteJson, getJson, patchJson } from './http'

export interface GetPagesParams {
  page?: number
  size?: number
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

export function deletePage(id: string) {
  return deleteJson<void>(`/pages/${id}`)
}

export function reorderPages(seq: Array<{ id: string; order: number }>) {
  return patchJson<void, { seq: Array<{ id: string; order: number }> }>(
    '/pages/reorder',
    { seq },
  )
}
