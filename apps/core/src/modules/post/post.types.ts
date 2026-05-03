import type { PostRow } from './post.repository'

export type PostModel = PostRow & {
  relatedId?: string[]
  related?: Partial<PostModel>[]
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
