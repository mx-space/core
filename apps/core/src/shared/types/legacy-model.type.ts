import type { ContentFormat } from './content-format.type'

export interface BaseModel {
  id?: string
  created?: Date
  [key: string]: any
}

export interface CountModel {
  read?: number
  like?: number
}

export interface BaseCommentIndexModel extends BaseModel {
  commentsIndex?: number
  allowComment?: boolean
}

export interface ImageModel {
  width?: number
  height?: number
  accent?: string
  type?: string
  src?: string
  blurHash?: string
}

export interface WriteBaseModel extends BaseCommentIndexModel {
  title: string
  text: string
  contentFormat: ContentFormat
  content?: string
  images?: ImageModel[]
  modified?: Date | null
  meta?: Record<string, any>
}

export const BASE_MODEL_PROTECTED_KEYS = ['createdAt', 'id']
export const BASE_COMMENT_INDEX_PROTECTED_KEYS = [...BASE_MODEL_PROTECTED_KEYS]
export const WRITE_BASE_MODEL_PROTECTED_KEYS = BASE_COMMENT_INDEX_PROTECTED_KEYS
