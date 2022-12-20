import { BaseModel } from './base'
import { PostModel } from './post'

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
export type CategoryWithChildrenModel = CategoryModel & {
  children: Pick<PostModel, 'id' | 'title' | 'slug' | 'modified' | 'created'>[]
}

export type CategoryEntries = {
  entries: Record<string, CategoryWithChildrenModel>
}
export interface TagModel {
  count: number
  name: string
}
