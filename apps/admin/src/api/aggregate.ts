import { getJson } from './http'

export interface StatCount {
  allComments?: number
  callTime: number
  categories: number
  comments: number
  linkApply?: number
  links: number
  notes: number
  online: number
  pages: number
  posts: number
  recently: number
  says: number
  tags?: number
  todayIpAccessCount: number
  todayMaxOnline: number
  todayOnlineTotal: number
  unreadComments: number
  uv: number
}

export interface CategoryDistribution {
  count: number
  id: string
  name: string
  slug: string
}

export interface PublicationTrendItem {
  date: string
  notes: number
  posts: number
}

export interface TagCloudItem {
  count: number
  tag: string
}

export interface TopArticle {
  category: { name: string; slug: string } | null
  id: string
  likes: number
  reads: number
  slug: string
  title: string
}

export interface CommentActivityItem {
  count: number
  date: string
}

export interface TrafficSourceData {
  browser: Array<{ count: number; name: string }>
  os: Array<{ count: number; name: string }>
}

export interface DeskCommentPreview {
  author: string
  id: string
  refTitle: string | null
  text: string
}

export interface DeskLinkPreview {
  id: string
  name: string
  url: string
}

export interface DeskScheduledNote {
  id: string
  nid: number
  publicAt: string
  title: string | null
}

export interface DeskSummary {
  linkApplications: {
    count: number
    latest: DeskLinkPreview | null
  }
  scheduledNotes: DeskScheduledNote[]
  unreadComments: {
    count: number
    latest: DeskCommentPreview | null
  }
}

export interface OnThisDayEntry {
  created: string
  excerpt: string
  id: string
  title: string | null
  type: 'note' | 'post'
}

export interface HeatmapDay {
  count: number
  date: string
}

export function getAggregateStat() {
  return getJson<StatCount>('/aggregate/stat')
}

export function getDesk() {
  return getJson<DeskSummary>('/aggregate/desk')
}

export function getOnThisDay() {
  return getJson<OnThisDayEntry[]>('/aggregate/on-this-day')
}

export function getPublishHeatmap() {
  return getJson<HeatmapDay[]>('/aggregate/publish-heatmap')
}

export function getCategoryDistribution() {
  return getJson<CategoryDistribution[]>(
    '/aggregate/stat/category-distribution',
  )
}

export function getPublicationTrend() {
  return getJson<PublicationTrendItem[]>('/aggregate/stat/publication-trend')
}

export function getTagCloud() {
  return getJson<TagCloudItem[]>('/aggregate/stat/tag-cloud')
}

export function getTopArticles() {
  return getJson<TopArticle[]>('/aggregate/stat/top-articles')
}

export function getCommentActivity() {
  return getJson<CommentActivityItem[]>('/aggregate/stat/comment-activity')
}

export function getTrafficSource() {
  return getJson<TrafficSourceData>('/aggregate/stat/traffic-source')
}

export function countSiteWords() {
  return getJson<{ count: number }>('/aggregate/count_site_words')
}

export function countReadAndLike() {
  return getJson<{ totalLikes: number; totalReads: number }>(
    '/aggregate/count_read_and_like',
  )
}

export function getSiteLikeCount() {
  return getJson<number>('/like_this')
}

export function cleanCache() {
  return getJson<void>('/clean_catch')
}

export function cleanRedis() {
  return getJson<void>('/clean_redis')
}
