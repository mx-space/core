import { adminQueryKeys } from '~/query/keys'

export const dashboardQueryKeys = {
  aggregateStat: adminQueryKeys.dashboard.aggregateStat(),
  appInfo: adminQueryKeys.dashboard.appInfo(),
  githubUpdate: adminQueryKeys.dashboard.githubUpdate(),
  home: adminQueryKeys.dashboard.home(),
  releaseDetail: adminQueryKeys.dashboard.releaseDetailRoot,
}

export const aggregateStatRefetchInterval = 3000
export const updateStaleTime = 60 * 60 * 1000

export const deskWritingItemLimit = 5

export const deskSplitMediaQuery = '(min-width: 1280px)'

export const closedUpdateTipsStorageKey = 'closed-tips'
