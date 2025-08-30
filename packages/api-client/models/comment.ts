import { CollectionRefTypes } from '@core/constants/db.constant'
import type { BaseModel } from './base'
import type { CategoryModel } from './category'

export { CollectionRefTypes }
export interface CommentModel extends BaseModel {
  refType: CollectionRefTypes
  ref: string
  state: number
  commentsIndex: number
  author: string
  text: string
  mail?: string
  url?: string
  ip?: string
  agent?: string
  key: string
  pin?: boolean

  avatar: string

  parent?: CommentModel | string
  children: CommentModel[]

  isWhispers?: boolean
  location?: string

  source?: string
  readerId?: string
  editedAt?: string
}
export interface CommentRef {
  id: string
  categoryId?: string
  slug: string
  title: string
  category?: CategoryModel
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}
