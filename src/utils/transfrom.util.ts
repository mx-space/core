import { PaginateResult } from 'mongoose'
import { Paginator } from '~/shared/model/base.model'

export function transformDataToPaginate<T = any>(
  data: PaginateResult<T>,
): {
  data: T[]
  pagination: Paginator
} {
  return {
    data: data.docs,
    pagination: {
      total: data.totalDocs,
      currentPage: data.page as number,
      totalPage: data.totalPages as number,
      size: data.limit,
      hasNextPage: data.hasNextPage,
      hasPrevPage: data.hasPrevPage,
    },
  }
}
