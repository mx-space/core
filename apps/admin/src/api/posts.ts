import type { Image, PaginateResult } from '~/models/base'
import type { PostModel } from '~/models/post'

import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

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

export interface CreatePostData {
  categoryId: string
  content?: string
  contentFormat?: 'lexical' | 'markdown'
  copyright?: boolean
  draftId?: string
  images?: Image[]
  isPublished?: boolean
  meta?: Record<string, unknown>
  pin?: null | string
  pinOrder?: null | number
  relatedId?: string[]
  slug?: string
  summary?: null | string
  tags?: string[]
  text: string
  title: string
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

export function createPost(data: CreatePostData) {
  return postJson<PostModel, CreatePostData>('/posts', data)
}

export function updatePost(id: string, data: Partial<CreatePostData>) {
  return putJson<PostModel, Partial<CreatePostData>>(`/posts/${id}`, data)
}

export function patchPost(id: string, data: Partial<PostModel>) {
  return patchJson<PostModel, Partial<PostModel>>(`/posts/${id}`, data)
}

export function deletePost(id: string) {
  return deleteJson<void>(`/posts/${id}`)
}
