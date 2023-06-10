import type { Count, Image, TextBaseModel } from './base'
import type { CategoryModel } from './category'

export interface PostModel extends TextBaseModel {
  summary?: string
  copyright: boolean
  tags: string[]
  count: Count
  text: string
  title: string
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
