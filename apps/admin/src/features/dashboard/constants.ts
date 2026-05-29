import type { StatCount } from '~/api/aggregate'
import { adminQueryKeys } from '~/query/keys'

export const dashboardQueryKeys = {
  aggregateStat: adminQueryKeys.dashboard.aggregateStat(),
  appInfo: adminQueryKeys.dashboard.appInfo(),
  categoryDistribution: adminQueryKeys.dashboard.categoryDistribution(),
  commentActivity: adminQueryKeys.dashboard.commentActivity(),
  githubUpdate: adminQueryKeys.dashboard.githubUpdate(),
  owner: adminQueryKeys.dashboard.owner(),
  publicationTrend: adminQueryKeys.dashboard.publicationTrend(),
  readLike: adminQueryKeys.dashboard.readLike(),
  releaseDetail: adminQueryKeys.dashboard.releaseDetailRoot,
  siteLike: adminQueryKeys.dashboard.siteLike(),
  tagCloud: adminQueryKeys.dashboard.tagCloud(),
  topArticles: adminQueryKeys.dashboard.topArticles(),
  trafficSource: adminQueryKeys.dashboard.trafficSource(),
  wordCount: adminQueryKeys.dashboard.wordCount(),
}

export const aggregateStatRefetchInterval = 3000
export const updateStaleTime = 60 * 60 * 1000

export const closedUpdateTipsStorageKey = 'closed-tips'

export const defaultStat: StatCount = {
  callTime: 0,
  categories: 0,
  comments: 0,
  linkApply: 0,
  links: 0,
  notes: 0,
  online: 0,
  pages: 0,
  posts: 0,
  recently: 0,
  says: 0,
  todayIpAccessCount: 0,
  todayMaxOnline: 0,
  todayOnlineTotal: 0,
  unreadComments: 0,
  uv: 0,
}
