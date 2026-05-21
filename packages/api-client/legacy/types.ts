import type { PaginateResult, Pager } from '~/models/base'

/**
 * Pagination shape emitted by {@link legacyResponseAdapter}.
 *
 * Extends the V3 {@link Pager} with the V2 aliases (`currentPage`,
 * `totalPage`) that the adapter re-injects for backward compatibility.
 *
 * Consumers reading those V2 field names should import this type instead of
 * the SDK's bare `Pager` — when the legacy adapter is eventually retired,
 * this file disappears and `Pager` stays clean.
 */
export interface LegacyPager extends Pager {
  /** V2 wire alias for {@link Pager.page}. */
  currentPage?: number
  /** V2 wire alias for {@link Pager.totalPages}. */
  totalPage?: number
}

/**
 * Paginated list response as observed through the legacy adapter — same shape
 * as {@link PaginateResult} but with `pagination` typed as {@link LegacyPager}.
 */
export interface LegacyPaginateResult<T> extends PaginateResult<T> {
  pagination: LegacyPager
}
