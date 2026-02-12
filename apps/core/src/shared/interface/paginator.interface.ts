export interface Pagination<T> {
  data: T[]
  pagination: Paginator
}

export class Paginator {
  readonly total: number
  readonly size: number
  readonly currentPage: number
  readonly totalPage: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}
