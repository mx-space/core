import type { EntityId } from '~/shared/id/entity-id'

export interface PostRow {
  id: EntityId
  title: string
  slug: string
  text: string
  content: string | null
  contentFormat: string
  summary: string | null
  images: unknown[] | null
  meta: Record<string, unknown> | null
  tags: string[]
  modifiedAt: Date | null
  categoryId: EntityId
  category?: {
    id: EntityId
    name: string
    slug: string
    type: number
  }
  copyright: boolean
  isPublished: boolean
  readCount: number
  likeCount: number
  pinAt: Date | null
  pinOrder: number | null
  createdAt: Date
  related?: PostRelatedSummary[]
}

export interface PostRelatedSummary {
  id: EntityId
  title: string
  slug: string
  summary: string | null
  categoryId: EntityId
  category?: {
    id: EntityId
    name: string
    slug: string
    type: number
  }
  createdAt: Date
  modifiedAt: Date | null
}

export interface PostCreateInput {
  title: string
  slug: string
  contentFormat: string
  createdAt?: Date
  text?: string | null
  content?: string | null
  summary?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  tags?: string[]
  categoryId: EntityId | string
  copyright?: boolean
  isPublished?: boolean
  pinAt?: Date | null
  pinOrder?: number | null
}

export type PostPatchInput = Partial<Omit<PostCreateInput, 'categoryId'>> & {
  categoryId?: EntityId | string
  modifiedAt?: Date | null
}

export interface PostListParams {
  page?: number
  size?: number
  categoryId?: EntityId | string
  categoryIds?: Array<EntityId | string>
  tag?: string
  publishedOnly?: boolean
  year?: number
  sortBy?: keyof PostRow
  sortOrder?: 1 | -1
  truncateText?: number
}

export interface PostTagCount {
  [key: string]: unknown
  name: string
  count: number
}

export interface PostListByCategoryOptions {
  includeCategory?: boolean
  limit?: number
  publishedOnly?: boolean
  metaOnly?: boolean
}

export type PostModel = PostRow & {
  relatedId?: string[]
}

export const POST_PROTECTED_KEYS = [
  'id',
  'createdAt',
  'readCount',
  'likeCount',
] as const

export interface PostPaginatorModel {
  data: PostRow[]
  pagination: any
}
