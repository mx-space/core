import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { CategoryType } from './category.enum'

export { CategoryType } from './category.enum'

export interface CategoryModel extends BaseModel {
  name: string
  type?: CategoryType
  slug: string
}

export type CategoryDocument = CategoryModel

export interface CategoryRow {
  id: string
  name: string
  slug: string
  type: CategoryType
  createdAt: Date
}

export interface CategoryWithCount extends CategoryRow {
  count: number
}

export interface CategoryCreateInput {
  name: string
  slug: string
  type?: CategoryType
}

export interface CategoryPatchInput {
  name?: string
  slug?: string
  type?: CategoryType
}
