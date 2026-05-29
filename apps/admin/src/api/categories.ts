import type { CategoryModel, TagModel } from '~/models/category'
import type { PostModel } from '~/models/post'

import { deleteJson, getJson, postJson, putJson } from './http'

export interface GetCategoriesParams {
  type?: 'Category' | 'Tag' | 'tag'
}

export interface CreateCategoryData {
  name: string
  slug: string
  type?: number
}

export type UpdateCategoryData = Partial<CreateCategoryData>

export function getCategories(params?: GetCategoriesParams) {
  return getJson<CategoryModel[]>('/categories', { type: params?.type })
}

export function getCategory(id: string) {
  return getJson<CategoryModel>(`/categories/${id}`)
}

export function createCategory(data: CreateCategoryData) {
  return postJson<CategoryModel, CreateCategoryData>('/categories', data)
}

export function updateCategory(id: string, data: UpdateCategoryData) {
  return putJson<CategoryModel, UpdateCategoryData>(`/categories/${id}`, data)
}

export function deleteCategory(id: string) {
  return deleteJson<void>(`/categories/${id}`)
}

export function getTags() {
  return getJson<TagModel[]>('/categories', { type: 'tag' })
}

interface PostsByTagResponse {
  data: PostModel[]
  tag: string
}

export async function getPostsByTag(tagName: string) {
  const result = await getJson<PostModel[] | PostsByTagResponse>(
    `/categories/${tagName}`,
    { tag: 'true' },
  )

  return Array.isArray(result) ? result : result.data
}
