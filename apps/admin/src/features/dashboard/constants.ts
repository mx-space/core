import type { StatCount } from '~/api/aggregate'

export const dashboardQueryKey = 'dashboard'

export const dashboardQueryKeys = {
  aggregateStat: [dashboardQueryKey, 'aggregate-stat'] as const,
  appInfo: [dashboardQueryKey, 'app-info'] as const,
  categoryDistribution: [dashboardQueryKey, 'category-distribution'] as const,
  commentActivity: [dashboardQueryKey, 'comment-activity'] as const,
  githubUpdate: [dashboardQueryKey, 'github-update'] as const,
  owner: [dashboardQueryKey, 'owner'] as const,
  publicationTrend: [dashboardQueryKey, 'publication-trend'] as const,
  readLike: [dashboardQueryKey, 'read-like'] as const,
  releaseDetail: [dashboardQueryKey, 'release-detail'] as const,
  siteLike: [dashboardQueryKey, 'site-like'] as const,
  tagCloud: [dashboardQueryKey, 'tag-cloud'] as const,
  topArticles: [dashboardQueryKey, 'top-articles'] as const,
  trafficSource: [dashboardQueryKey, 'traffic-source'] as const,
  wordCount: [dashboardQueryKey, 'word-count'] as const,
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
