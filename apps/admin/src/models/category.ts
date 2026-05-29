import type { PostModel } from './post'

export enum CategoryType {
  Category,
  Tag,
}

export interface CategoryModel {
  id: string
  createdAt: string
  type: CategoryType
  count: number
  slug: string
  name: string
}

export interface CategoryResponse {
  data: CategoryModel[]
}

export type CategoryWithChildrenModel = CategoryModel & {
  children: PickedPostModelInCategoryChildren[]
}

export type PickedPostModelInCategoryChildren = Pick<
  PostModel,
  'id' | 'title' | 'slug' | 'modifiedAt' | 'createdAt'
>

export interface TagModel {
  count: number
  name: string
}
