export interface Pager {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface PaginateResult<T> {
  data: T[]
  pagination: Pager
}

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
  thumbhash?: string
}

export class BaseModel {
  created: string = ''
  id: string = ''
}
