import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

export type SortOptions = {
  sortBy?: string
  sortOrder?: 1 | -1 | 'asc' | 'desc'
}
export abstract class BaseCrudController<T, ResponseWrapper> {
  base!: string
  constructor(protected client: HTTPClient) {
    autoBind(this)
  }
  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getById(id: string): RequestProxyResult<T, ResponseWrapper> {
    return this.proxy(id).get<T>()
  }

  getAll() {
    return this.proxy.all.get<{ data: T[] }>()
  }
  /**
   * 带分页的查询
   * @param page
   * @param perPage
   */
  getAllPaginated(page?: number, perPage?: number, sortOption?: SortOptions) {
    return this.proxy.get<PaginateResult<T>>({
      params: { page, size: perPage, ...sortOption },
    })
  }
}
