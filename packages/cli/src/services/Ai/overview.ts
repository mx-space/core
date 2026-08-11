import type { Effect } from 'effect'

import type { ApiError, ApiService } from '../Api'
import type { AiOverviewListQuery } from './types'

export const makeOverview = (api: ApiService) => ({
  listOverview: (q: AiOverviewListQuery): Effect.Effect<unknown, ApiError> =>
    api.request('/ai/overview/grouped', {
      query: {
        page: q.page,
        size: q.size,
        search: q.search,
        type: q.type,
      },
    }),
  getOverviewByArticle: (refId: string): Effect.Effect<unknown, ApiError> =>
    api.request(`/ai/overview/article/${refId}`),
})
