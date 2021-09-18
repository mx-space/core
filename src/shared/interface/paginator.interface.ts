import { Paginator } from '../model/base.model'

export interface Pagination<T> {
  data: T[]
  pagination: Paginator
}
