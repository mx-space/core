export interface Count {
  read: number
  like: number
}

export interface Image {
  height: number
  width: number
  type: string
  accent?: string
  src: string
}

export interface Pager {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface PaginateResult<T> {
  data: T[]
  pagination: Pager
}

export interface BaseModel {
  created: string
  id: string
}

export interface BaseCommentIndexModel extends BaseModel {
  commentsIndex?: number

  allowComment: boolean
}
export interface TextBaseModel extends BaseCommentIndexModel {
  title: string
  text: string
  images?: Image[]
  modified: string | null

  meta?: Record<string, any>
}
