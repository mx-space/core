import type { PaginateResult } from '~/models/base'
import type { PostModel } from '~/models/post'

import { deleteJson, getJson, patchJson } from './http'

export type PostSortKey = 'createdAt' | 'modifiedAt' | 'pinAt'
export type PostSortOrder = 'asc' | 'desc'

export interface GetPostsParams {
  categoryIds?: string[]
  page: number
  size: number
  sort_by?: PostSortKey
  sort_order?: PostSortOrder
}

export interface SearchPostsParams {
  keyword: string
  page: number
  size: number
}

export interface PatchPostData {
  categoryId?: string
  pinAt?: null | string
}

export function getPosts(params: GetPostsParams) {
  return getJson<PaginateResult<PostModel>>('/posts', {
    categoryIds: params.categoryIds,
    page: params.page,
    size: params.size,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

export function searchPosts(params: SearchPostsParams) {
  return getJson<PaginateResult<PostModel>>('/search/post', {
    keyword: params.keyword,
    page: params.page,
    size: params.size,
  })
}

export function getPostById(id: string) {
  return getJson<PostModel>(`/posts/${id}`)
}

export function patchPost(id: string, data: PatchPostData) {
  return patchJson<PostModel, PatchPostData>(`/posts/${id}`, data)
}

export function patchPostPublish(id: string, isPublished: boolean) {
  return patchJson<PostModel, { isPublished: boolean }>(
    `/posts/${id}/publish`,
    { isPublished },
  )
}

export function deletePost(id: string) {
  return deleteJson<void>(`/posts/${id}`)
}
