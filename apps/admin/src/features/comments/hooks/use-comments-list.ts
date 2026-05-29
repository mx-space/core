import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getComments } from '~/api/comments'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { CommentState } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

import { commentsPageSize } from '../constants'
import { normalizeCommentState, readCommentPage } from '../utils/comments'

interface CommentsListState {
  page: number
  state: CommentState
}

export function useCommentsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): CommentsListState => ({
        page: readCommentPage(searchParams.get('page')),
        state: normalizeCommentState(searchParams.get('state')),
      }),
      write: (state: CommentsListState) => {
        const nextParams = new URLSearchParams()
        nextParams.set('state', String(state.state))
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const commentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getComments({
        page: state.page,
        size: commentsPageSize,
        state: state.state,
      }),
    queryKey: adminQueryKeys.comments.list({
      page: state.page,
      size: commentsPageSize,
      state: state.state,
    }),
  })

  return {
    comments: commentsQuery.data?.data ?? [],
    commentsQuery,
    page: state.page,
    pagination: commentsQuery.data?.pagination,
    setPage: (page: number | ((current: number) => number)) => {
      setState((current) => ({
        ...current,
        page: typeof page === 'function' ? page(current.page) : page,
      }))
    },
    setState: (nextState: CommentState) =>
      setState((current) => ({ ...current, page: 1, state: nextState })),
    state: state.state,
  }
}
