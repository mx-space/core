import type { Count, Image, TextBaseModel } from './base'
import type { CategoryModel } from './category'

export type PostModel = TextBaseModel & {
  summary?: string | null
  copyright: boolean
  tags: string[]
  count: Count
  slug: string
  categoryId: string
  images: Image[]
  category: CategoryModel
  pin?: string | null
  pinOrder?: number
  related?: Pick<
    PostModel,
    | 'id'
    | 'category'
    | 'categoryId'
    | 'created'
    | 'modified'
    | 'title'
    | 'slug'
    | 'summary'
  >[]
}
