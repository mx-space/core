import type { mongoose } from '@typegoose/typegoose'
import type { Pagination } from '~/shared/interface/paginator.interface'

export function transformDataToPaginate<T = any>(
  data: mongoose.PaginateResult<T>,
): Pagination<T> {
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
