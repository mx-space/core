import type { Image } from './base'
import type { CategoryModel } from './category'

export type PostContentFormat = 'markdown' | 'lexical'

export interface PostModelMarkdown {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  text: string
  contentFormat?: 'markdown'
  content?: undefined
  meta?: Record<string, any> | null
  summary?: string | null
  copyright: boolean
  tags: string[]
  slug: string
  categoryId: string
  category: CategoryModel
  images?: Image[] | null
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt?: string | null
  pinOrder?: number | null
  related?: PostRelatedSummary[]
}

export interface PostModelLexical {
  id: string
  createdAt: string
  modifiedAt: string | null
  title: string
  text?: string
  contentFormat: 'lexical'
  content: string
  meta?: Record<string, any> | null
  summary?: string | null
  copyright: boolean
  tags: string[]
  slug: string
  categoryId: string
  category: CategoryModel
  images?: Image[] | null
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt?: string | null
  pinOrder?: number | null
  related?: PostRelatedSummary[]
}

export type PostModel = PostModelMarkdown | PostModelLexical

export interface PostRelatedSummary {
  id: string
  title: string
  slug: string
  summary: string | null
  categoryId: string
  category?: CategoryModel
  createdAt: string
  modifiedAt: string | null
}
