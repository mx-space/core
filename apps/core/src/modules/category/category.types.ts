import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { CategoryType } from './category.enum'

export interface CategoryModel extends BaseModel {
  name: string
  type?: CategoryType
  slug: string
}

export type CategoryDocument = CategoryModel
