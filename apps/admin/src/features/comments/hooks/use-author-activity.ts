import { useQuery } from '@tanstack/react-query'

import { getAuthorActivity } from '~/api/comments'
import { adminQueryKeys } from '~/query/keys'

interface UseAuthorActivityParams {
  mail?: string
  ip?: string
  limit?: number
}

const AUTHOR_ACTIVITY_STALE_MS = 5 * 60_000

export function useAuthorActivity(params: UseAuthorActivityParams) {
  const enabled = Boolean(params.mail || params.ip)

  const query = useQuery({
    enabled,
    placeholderData: (previous) => previous,
    queryFn: () =>
      getAuthorActivity({
        ip: params.ip,
        limit: params.limit,
        mail: params.mail,
      }),
    queryKey: adminQueryKeys.comments.authorActivity({
      ip: params.ip,
      mail: params.mail,
    }),
    staleTime: AUTHOR_ACTIVITY_STALE_MS,
  })

  return {
    activity: query.data,
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    query,
  }
}
