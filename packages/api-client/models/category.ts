import type { PostModel } from './post'

export enum CategoryType {
  Category,
  Tag,
}

export interface CategoryModel {
  id: string
  createdAt: string
  type: CategoryType
  slug: string
  name: string
  count?: number
}

export type CategoryChildPost = Pick<
  PostModel,
  | 'id'
  | 'title'
  | 'slug'
  | 'modifiedAt'
  | 'createdAt'
  | 'tags'
  | 'pinAt'
  | 'readCount'
  | 'likeCount'
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
  | 'createdAt'
  | 'modifiedAt'
  | 'summary'
  | 'tags'
  | 'pinAt'
  | 'readCount'
  | 'likeCount'
>
