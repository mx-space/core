import type { WriteBaseModel } from '~/shared/types/legacy-model.type'

import type { CategoryModel } from '../category/category.types'
import type { PostRow } from './post.repository'

export interface PostModel extends WriteBaseModel {
  slug: string
  summary?: string | null
  categoryId: any
  category?: CategoryModel
  copyright?: boolean
  isPublished?: boolean
  tags?: string[]
  count?: { read?: number; like?: number }
  pin?: Date | null
  pinOrder?: number
  relatedId?: string[]
  related?: Partial<PostModel>[]
}

export const POST_PROTECTED_KEYS = [
  'count',
  'commentsIndex',
  'created',
  'id',
  '_id',
] as const

export interface PostPaginatorModel {
  data: PostModel[]
  pagination: any
}

export type PostLegacyModel = PostModel | PostRow
