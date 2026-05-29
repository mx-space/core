import type { Image, Pager } from './base'

export interface PostResponse {
  data: PostModel[]
  pagination: Pager
}

export interface PostModel {
  copyright: boolean
  tags: string[]
  readCount: number
  likeCount: number
  id: string
  text: string
  title: string
  slug: string
  categoryId: string
  images: Image[]
  modifiedAt: string | null
  createdAt: string
  category: Category
  contentFormat?: 'markdown' | 'lexical'
  content?: string
  summary?: string | null
  pinAt?: string | null
  pinOrder?: number | null
  related?: Pick<
    PostModel,
    | 'id'
    | 'title'
    | 'slug'
    | 'categoryId'
    | 'modifiedAt'
    | 'createdAt'
    | 'category'
    | 'summary'
  >[]
  meta?: any
  isPublished?: boolean
}

export interface Category {
  type: number
  id: string
  name: string
  slug: string
}
