import type { Pagination } from '~/shared/interface/paginator.interface'

type MongoosePaginateResult<T> = {
  docs: T[]
  totalDocs: number
  page?: number
  totalPages?: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function transformDataToPaginate<T = any>(
  data: MongoosePaginateResult<T> | Pagination<T>,
): Pagination<T> {
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as Pagination<T>).data) &&
    (data as Pagination<T>).pagination &&
    typeof (data as Pagination<T>).pagination === 'object'
  ) {
    return data as Pagination<T>
  }
  const m = data as MongoosePaginateResult<T>
  return {
    data: m.docs,
    pagination: {
      total: m.totalDocs,
      currentPage: m.page as number,
      totalPage: m.totalPages as number,
      size: m.limit,
      hasNextPage: m.hasNextPage,
      hasPrevPage: m.hasPrevPage,
    },
  }
}
