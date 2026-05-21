import type { PaginateResult, Pager } from '~/models/base'

/**
 * Pagination shape emitted by {@link legacyResponseAdapter}.
 *
 * The adapter unconditionally derives all six fields from the V3
 * `{ page, size, total, totalPages }` envelope meta, so consumers can read
 * them without optional-chaining. Both the V3 names (`page`, `totalPages`,
 * `hasNextPage`, `hasPrevPage`) and the V2 aliases (`currentPage`,
 * `totalPage`) are present.
 *
 * Import this from `@mx-space/api-client/legacy` when a list endpoint is
 * being consumed through the legacy adapter — the SDK's bare {@link Pager}
 * leaves `hasNextPage` / `hasPrevPage` optional and has no V2 aliases.
 * When the legacy adapter is eventually retired this file goes with it and
 * `Pager` stays clean.
 */
export interface LegacyPager extends Omit<Pager, 'hasNextPage' | 'hasPrevPage'> {
  hasNextPage: boolean
  hasPrevPage: boolean
  /** V2 wire alias for {@link Pager.page}. */
  currentPage: number
  /** V2 wire alias for {@link Pager.totalPages}. */
  totalPage: number
}

/**
 * Paginated list response as observed through the legacy adapter — same shape
 * as {@link PaginateResult} but with `pagination` typed as {@link LegacyPager}.
 */
export interface LegacyPaginateResult<T> extends PaginateResult<T> {
  pagination: LegacyPager
}
