import { adminQueryKeys } from '~/query/keys'

export const dashboardQueryKeys = {
  aggregateStat: adminQueryKeys.dashboard.aggregateStat(),
  appInfo: adminQueryKeys.dashboard.appInfo(),
  desk: adminQueryKeys.dashboard.desk(),
  deskDrafts: adminQueryKeys.dashboard.deskDrafts(),
  githubUpdate: adminQueryKeys.dashboard.githubUpdate(),
  owner: adminQueryKeys.dashboard.owner(),
  releaseDetail: adminQueryKeys.dashboard.releaseDetailRoot,
}

export const aggregateStatRefetchInterval = 3000
export const updateStaleTime = 60 * 60 * 1000

export const deskWritingItemLimit = 5

export const closedUpdateTipsStorageKey = 'closed-tips'
