import type { BaseModel } from './base'
import type { PostModel } from './post'

export enum CategoryType {
  Category,
  Tag,
}

export interface CategoryModel extends BaseModel {
  type: CategoryType
  count: number
  slug: string
  name: string
}

export type CategoryChildPost = Pick<
  PostModel,
  | 'id'
  | 'title'
  | 'slug'
  | 'modified'
  | 'created'
  | 'summary'
  | 'tags'
  | 'pin'
  | 'count'
  | 'images'
>

export type CategoryWithChildrenModel = CategoryModel & {
  children: CategoryChildPost[]
  /** Aggregated tag-name → post-count for posts under this category. */
  tagsSum?: Array<{ name: string; count: number }>
}

export type CategoryEntries = {
  entries: Record<string, CategoryWithChildrenModel>
}

export interface TagModel {
  count: number
  name: string
}

export type TagDetailPost = Pick<
  PostModel,
  | 'id'
  | 'title'
  | 'slug'
  | 'category'
  | 'created'
  | 'modified'
  | 'summary'
  | 'tags'
  | 'pin'
  | 'count'
>
