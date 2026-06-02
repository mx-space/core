import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { CommentRefType } from '~/api/comments'
import { getCommentTabCounts } from '~/api/comments'
import { adminQueryKeys } from '~/query/keys'

interface UseCommentTabCountsParams {
  refType?: CommentRefType
  refId?: string
}

const TAB_COUNTS_STALE_MS = 30_000

export function useCommentTabCounts(params: UseCommentTabCountsParams = {}) {
  const queryClient = useQueryClient()
  const filter = { refId: params.refId, refType: params.refType }
  const queryKey = adminQueryKeys.comments.tabCounts(filter)

  const query = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getCommentTabCounts(filter),
    queryKey,
    staleTime: TAB_COUNTS_STALE_MS,
  })

  // queryKey is a stable shape per render — derive its identity from the
  // primitive filter fields so invalidate() does not change every render.
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, params.refType, params.refId],
  )

  return {
    counts: query.data,
    invalidate,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    query,
  }
}
