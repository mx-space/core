export interface Pagination<T> {
  data: T[]
  pagination: Paginator
}
export class Paginator {
  /**
   * 总条数
   */
  readonly total: number
  /**
   * 一页多少条
   */
  readonly size: number
  /**
   * 当前页
   */
  readonly currentPage: number
  /**
   * 总页数
   */
  readonly totalPage: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}
