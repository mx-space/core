import type { WriteBaseModel } from '~/shared/types/legacy-model.type'

export interface PageModel extends WriteBaseModel {
  slug: string
  subtitle?: string | null
  order: number
}

export const PAGE_PROTECTED_KEYS = [
  'commentsIndex',
  'created',
  'id',
  '_id',
] as const
