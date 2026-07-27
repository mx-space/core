import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BookOpen,
  Clock3,
  File,
  FileText,
  Gauge,
  Heart,
  Link,
  MessageSquare,
  Radio,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router'

import {
  countReadAndLike,
  countSiteWords,
  getAggregateStat,
  getCategoryDistribution,
  getCommentActivity,
  getPublicationTrend,
  getSiteLikeCount,
  getTagCloud,
  getTopArticles,
  getTrafficSource,
} from '~/api/aggregate'
import { useI18n } from '~/i18n'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'

import {
  aggregateStatRefetchInterval,
  defaultStat,
  insightsQueryKeys,
} from '../constants'
import { BarPanel } from './BarPanel'
import { LiveCard, StatCell } from './InsightsPrimitives'
import { TagCloudPanel } from './TagCloudPanel'
import { TopArticlesPanel } from './TopArticlesPanel'
import { TrafficPanel } from './TrafficPanel'

export function InsightsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const statQuery = useQuery({
    queryFn: getAggregateStat,
    queryKey: insightsQueryKeys.aggregateStat,
    refetchInterval: aggregateStatRefetchInterval,
  })
  const stat = statQuery.data ?? defaultStat
  const wordCountQuery = useQuery({
    queryFn: countSiteWords,
    queryKey: insightsQueryKeys.wordCount,
  })
  const readLikeQuery = useQuery({
    queryFn: countReadAndLike,
    queryKey: insightsQueryKeys.readLike,
  })
  const siteLikeQuery = useQuery({
    queryFn: getSiteLikeCount,
    queryKey: insightsQueryKeys.siteLike,
  })
  const categoryQuery = useQuery({
    queryFn: getCategoryDistribution,
    queryKey: insightsQueryKeys.categoryDistribution,
  })
  const trendQuery = useQuery({
    queryFn: getPublicationTrend,
    queryKey: insightsQueryKeys.publicationTrend,
  })
  const tagsQuery = useQuery({
    queryFn: getTagCloud,
    queryKey: insightsQueryKeys.tagCloud,
  })
  const topArticlesQuery = useQuery({
    queryFn: getTopArticles,
    queryKey: insightsQueryKeys.topArticles,
  })
  const commentActivityQuery = useQuery({
    queryFn: getCommentActivity,
    queryKey: insightsQueryKeys.commentActivity,
  })
  const trafficSourceQuery = useQuery({
    queryFn: getTrafficSource,
    queryKey: insightsQueryKeys.trafficSource,
  })

  return (
    <AppPage>
      <PageHeader
        description={t('insights.page.description')}
        title={t('insights.page.title')}
      />
      <Scroll
        className="min-h-0 flex-1 bg-background"
        innerClassName="flex flex-col p-4"
      >
        <section className="grid gap-px bg-border-strong md:grid-cols-3">
          <LiveCard
            icon={Radio}
            label={t('insights.live.online')}
            live
            value={stat.online}
          />
          <LiveCard
            icon={Users}
            label={t('insights.live.todayVisitors')}
            value={stat.todayOnlineTotal}
          />
          <LiveCard
            icon={TrendingUp}
            label={t('insights.live.todayMax')}
            value={stat.todayMaxOnline}
          />
        </section>

        <Panel className="mt-6" title={t('insights.panel.stats.title')}>
          <div className="grid gap-px bg-border-strong sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCell
              icon={File}
              label={t('insights.stat.pages')}
              onClick={() => navigate('/pages')}
              value={stat.pages}
            />
            <StatCell
              icon={Tags}
              label={t('insights.stat.categories')}
              onClick={() => navigate('/posts/category')}
              value={stat.categories}
            />
            <StatCell
              icon={MessageSquare}
              label={t('insights.stat.comments.all')}
              onClick={() => navigate('/comments?state=1')}
              value={stat.allComments ?? stat.comments}
            />
            <StatCell
              icon={MessageSquare}
              label={t('insights.stat.comments.unread')}
              onClick={() => navigate('/comments?state=0')}
              value={stat.unreadComments}
            />
            <StatCell
              icon={Link}
              label={t('insights.stat.friends.label')}
              onClick={() => navigate('/friends?state=0')}
              value={stat.links}
            />
            <StatCell
              icon={Link}
              label={t('insights.stat.friends.applications')}
              onClick={() => navigate('/friends?state=1')}
              value={stat.linkApply ?? 0}
            />
            <StatCell
              icon={Activity}
              label={t('insights.stat.apiCalls')}
              onClick={() => navigate('/analyze')}
              value={stat.callTime}
            />
            <StatCell
              icon={Gauge}
              label={t('insights.stat.todayIp')}
              onClick={() => navigate('/analyze')}
              value={stat.todayIpAccessCount}
            />
            <StatCell
              icon={FileText}
              label={t('insights.stat.wordCount')}
              value={wordCountQuery.data?.count ?? 0}
            />
            <StatCell
              icon={BookOpen}
              label={t('insights.stat.reads')}
              value={readLikeQuery.data?.totalReads ?? 0}
            />
            <StatCell
              icon={Heart}
              label={t('insights.stat.likes.post')}
              value={readLikeQuery.data?.totalLikes ?? 0}
            />
            <StatCell
              icon={Heart}
              label={t('insights.stat.likes.site')}
              value={siteLikeQuery.data ?? 0}
            />
            <StatCell
              icon={Clock3}
              label={t('insights.stat.uv')}
              onClick={() => navigate('/analyze')}
              value={stat.uv}
            />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                aria-hidden="true"
                className="bg-surface-card"
                key={`stat-spacer-${i}`}
              />
            ))}
          </div>
        </Panel>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <BarPanel
            items={(trendQuery.data ?? []).map((item) => ({
              label: item.date,
              value: item.posts + item.notes,
            }))}
            title={t('insights.bar.publicationTrend.title')}
          />
          <BarPanel
            items={(categoryQuery.data ?? []).map((item) => ({
              label: item.name,
              value: item.count,
            }))}
            title={t('insights.stat.distribution')}
          />
          <BarPanel
            items={(commentActivityQuery.data ?? []).map((item) => ({
              label: item.date,
              value: item.count,
            }))}
            title={t('insights.bar.commentActivity.title')}
          />
          <TrafficPanel data={trafficSourceQuery.data} />
          <TopArticlesPanel articles={topArticlesQuery.data ?? []} />
          <TagCloudPanel tags={tagsQuery.data ?? []} />
        </section>
      </Scroll>
    </AppPage>
  )
}
