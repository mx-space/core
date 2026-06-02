import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { CommentListState, CommentRefType } from '~/api/comments'
import { getComments } from '~/api/comments'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import type { CommentTab } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

import { commentsPageSize } from '../constants'
import {
  legacyStateToTab,
  normalizeCommentRefType,
  normalizeCommentTab,
  readCommentPage,
  tabToLegacyState,
} from '../utils/comments'

interface CommentsListState {
  author?: string
  page: number
  refId?: string
  refType?: CommentRefType
  search?: string
  tab: CommentTab
}

export function useCommentsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): CommentsListState => {
        const rawTab = searchParams.get('tab')
        // One-shot migration: if no `?tab=` is present but a legacy `?state=`
        // is, translate it. The migration runs once because the writer always
        // emits `?tab=` and never `?state=`.
        const migratedTab = rawTab
          ? null
          : legacyStateToTab(searchParams.get('state'))
        return {
          author: searchParams.get('author') || undefined,
          page: readCommentPage(searchParams.get('page')),
          refId: searchParams.get('refId') || undefined,
          refType: normalizeCommentRefType(searchParams.get('refType')),
          search: searchParams.get('search') || undefined,
          tab: rawTab ? normalizeCommentTab(rawTab) : (migratedTab ?? 'unread'),
        }
      },
      write: (state: CommentsListState) => {
        const nextParams = new URLSearchParams()
        nextParams.set('tab', state.tab)
        if (state.refType) nextParams.set('refType', state.refType)
        if (state.refId) nextParams.set('refId', state.refId)
        if (state.search) nextParams.set('search', state.search)
        if (state.author) nextParams.set('author', state.author)
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  // The legacy `?state=` parameter is honored by the server for one release.
  // Pass `tab` as the canonical value; derive the legacy `state` for older
  // servers that only know `?state=`.
  const legacyState = tabToLegacyState(state.tab)

  const commentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getComments({
        author: state.author,
        page: state.page,
        refId: state.refId,
        refType: state.refType,
        search: state.search,
        size: commentsPageSize,
        state: legacyState,
        tab: state.tab,
      }),
    queryKey: adminQueryKeys.comments.list({
      author: state.author,
      page: state.page,
      refId: state.refId,
      refType: state.refType,
      search: state.search,
      size: commentsPageSize,
      state: legacyState,
      tab: state.tab,
    }),
  })

  return {
    author: state.author,
    comments: commentsQuery.data?.data ?? [],
    commentsQuery,
    page: state.page,
    pagination: commentsQuery.data?.pagination,
    refId: state.refId,
    refType: state.refType,
    search: state.search,
    setFilters: (
      next:
        | Partial<Omit<CommentsListState, 'page'>>
        | ((
            current: Omit<CommentsListState, 'page'>,
          ) => Partial<Omit<CommentsListState, 'page'>>),
    ) =>
      setState((current) => {
        const patch =
          typeof next === 'function'
            ? next({
                author: current.author,
                refId: current.refId,
                refType: current.refType,
                search: current.search,
                tab: current.tab,
              })
            : next
        return { ...current, ...patch, page: 1 }
      }),
    setPage: (page: number | ((current: number) => number)) => {
      setState((current) => ({
        ...current,
        page: typeof page === 'function' ? page(current.page) : page,
      }))
    },
    setTab: (nextTab: CommentTab) =>
      setState((current) => ({ ...current, page: 1, tab: nextTab })),
    /**
     * Back-compat shim for callers that still pass numeric `CommentListState`.
     * Routes the value through `setTab` so URL state stays canonical.
     */
    setState: (nextState: CommentListState) =>
      setState((current) => ({
        ...current,
        page: 1,
        tab: legacyStateToTabValue(nextState),
      })),
    /** Backward-compatible alias for the legacy numeric/`'all'` form. */
    state: legacyState,
    tab: state.tab,
  }
}

function legacyStateToTabValue(value: CommentListState): CommentTab {
  if (value === 'all') return 'all'
  if (value === 0) return 'unread'
  if (value === 1) return 'read'
  return 'junk'
}
