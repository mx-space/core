import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BookOpen,
  BrushCleaning,
  Clock3,
  File,
  FileText,
  Gauge,
  Heart,
  Link,
  MessageSquare,
  Pencil,
  Quote,
  Radio,
  RefreshCw,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
  cleanCache,
  cleanRedis,
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
import { checkUpdateFromGitHub } from '~/api/github-update'
import { getOwner } from '~/api/options'
import { rebuildSearchIndex } from '~/api/search-index'
import { getAppInfo } from '~/api/system'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { isNewerVersion } from '~/utils/version'

import {
  aggregateStatRefetchInterval,
  dashboardQueryKeys,
  defaultStat,
  updateStaleTime,
} from '../constants'
import {
  formatSearchIndexStats,
  getErrorMessage,
  readClosedUpdateTips,
  writeClosedUpdateTip,
} from '../utils/dashboard'
import { ActionCard } from './ActionCard'
import { BarPanel } from './BarPanel'
import { LiveCard, MaintenanceCard, StatCell } from './DashboardPrimitives'
import { DashboardRuntimeFooter } from './DashboardRuntimeFooter'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { OwnerLoginStat } from './OwnerLoginStat'
import { SearchIndexRebuildCard } from './SearchIndexRebuildCard'
import { TagCloudPanel } from './TagCloudPanel'
import { TopArticlesPanel } from './TopArticlesPanel'
import { TrafficPanel } from './TrafficPanel'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DashboardRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notifiedUpdatesRef = useRef(new Set<string>())
  const statQuery = useQuery({
    queryFn: getAggregateStat,
    queryKey: dashboardQueryKeys.aggregateStat,
    refetchInterval: aggregateStatRefetchInterval,
  })
  const stat = statQuery.data ?? defaultStat
  const wordCountQuery = useQuery({
    queryFn: countSiteWords,
    queryKey: dashboardQueryKeys.wordCount,
  })
  const readLikeQuery = useQuery({
    queryFn: countReadAndLike,
    queryKey: dashboardQueryKeys.readLike,
  })
  const siteLikeQuery = useQuery({
    queryFn: getSiteLikeCount,
    queryKey: dashboardQueryKeys.siteLike,
  })
  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: dashboardQueryKeys.owner,
    retry: false,
  })
  const appInfoQuery = useQuery({
    queryFn: getAppInfo,
    queryKey: dashboardQueryKeys.appInfo,
    retry: false,
  })
  const adminVersion = __DEV__ ? 'dev mode' : window.version || 'N/A'
  const systemVersion = appInfoQuery.data?.version || 'N/A'
  const updateQuery = useQuery({
    enabled:
      !__DEV__ &&
      appInfoQuery.isSuccess &&
      !appInfoQuery.data?.version?.startsWith('demo'),
    queryFn: checkUpdateFromGitHub,
    queryKey: dashboardQueryKeys.githubUpdate,
    retry: false,
    staleTime: updateStaleTime,
  })
  const categoryQuery = useQuery({
    queryFn: getCategoryDistribution,
    queryKey: dashboardQueryKeys.categoryDistribution,
  })
  const trendQuery = useQuery({
    queryFn: getPublicationTrend,
    queryKey: dashboardQueryKeys.publicationTrend,
  })
  const tagsQuery = useQuery({
    queryFn: getTagCloud,
    queryKey: dashboardQueryKeys.tagCloud,
  })
  const topArticlesQuery = useQuery({
    queryFn: getTopArticles,
    queryKey: dashboardQueryKeys.topArticles,
  })
  const commentActivityQuery = useQuery({
    queryFn: getCommentActivity,
    queryKey: dashboardQueryKeys.commentActivity,
  })
  const trafficSourceQuery = useQuery({
    queryFn: getTrafficSource,
    queryKey: dashboardQueryKeys.trafficSource,
  })

  const cleanCacheMutation = useMutation({
    mutationFn: cleanCache,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('dashboard.toast.apiCacheClearError')),
      ),
    onSuccess: () => toast.success(t('dashboard.toast.apiCacheCleared')),
  })
  const cleanRedisMutation = useMutation({
    mutationFn: cleanRedis,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('dashboard.toast.dataCacheClearError')),
      ),
    onSuccess: () => toast.success(t('dashboard.toast.dataCacheCleared')),
  })
  const rebuildSearchIndexMutation = useMutation({
    mutationFn: rebuildSearchIndex,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('dashboard.searchIndex.rebuildError')),
      ),
    onSuccess: async (result) => {
      toast.success(formatSearchIndexStats(result))
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.searchIndex.root,
      })
    },
  })

  const updatedAt = useMemo(() => new Date(), [statQuery.dataUpdatedAt])

  useEffect(() => {
    if (__DEV__) return
    if (appInfoQuery.data?.version?.startsWith('demo')) {
      toast.info(t('dashboard.demoMode.tip'))
    }
  }, [appInfoQuery.data?.version])

  useEffect(() => {
    const updates = updateQuery.data
    if (!updates || __DEV__) return

    const closedTips = readClosedUpdateTips()

    if (
      isNewerVersion(adminVersion, updates.dashboard) &&
      closedTips.dashboard !== updates.dashboard &&
      !notifiedUpdatesRef.current.has(`dashboard:${updates.dashboard}`)
    ) {
      notifiedUpdatesRef.current.add(`dashboard:${updates.dashboard}`)
      toast.info(
        t('dashboard.update.adminAvailable', {
          current: adminVersion,
          latest: updates.dashboard,
        }),
        {
          action: {
            label: t('dashboard.update.update'),
            onClick: () => {
              writeClosedUpdateTip('dashboard', updates.dashboard)
              presentDashboardUpgrade()
            },
          },
          duration: 10000,
        },
      )
    }

    if (
      isNewerVersion(systemVersion, updates.system) &&
      closedTips.system !== updates.system &&
      !notifiedUpdatesRef.current.has(`system:${updates.system}`)
    ) {
      notifiedUpdatesRef.current.add(`system:${updates.system}`)
      toast.info(
        t('dashboard.update.systemAvailable', {
          current: systemVersion,
          latest: updates.system,
        }),
        {
          action: {
            label: t('common.view'),
            onClick: () => {
              writeClosedUpdateTip('system', updates.system)
              presentUpdateRelease({
                repo: 'mx-server',
                title: t('dashboard.release.systemTitle'),
                version: updates.system,
              })
            },
          },
          duration: 10000,
        },
      )
    }
  }, [adminVersion, systemVersion, updateQuery.data])

  return (
    <AppPage>
      <PageHeader
        actions={
          <Button
            className="text-xs"
            disabled={statQuery.isFetching}
            onClick={() => void statQuery.refetch()}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-3.5', statQuery.isFetching && 'animate-spin')}
            />
            {t('dashboard.header.refresh')}
          </Button>
        }
        description={t('dashboard.header.subtitle')}
        title={t('dashboard.header.title')}
      />
      <Scroll
        className="min-h-0 flex-1 bg-background"
        innerClassName="flex flex-col p-4"
      >
        <section className="grid gap-px bg-border-strong md:grid-cols-3">
          <LiveCard
            icon={Radio}
            label={t('dashboard.live.online')}
            live
            value={stat.online}
          />
          <LiveCard
            icon={Users}
            label={t('dashboard.live.todayVisitors')}
            value={stat.todayOnlineTotal}
          />
          <LiveCard
            icon={TrendingUp}
            label={t('dashboard.live.todayMax')}
            value={stat.todayMaxOnline}
          />
        </section>

        <Panel
          className="mt-6"
          description={t('dashboard.panel.quickActions.updatedAt', {
            time: updatedAt.toLocaleTimeString(),
          })}
          title={t('dashboard.panel.quickActions.title')}
        >
          <div className="grid gap-px bg-border-strong sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              icon={FileText}
              label={t('dashboard.action.label.posts')}
              onManage={() => navigate('/posts')}
              onPrimary={() => navigate('/posts/edit')}
              primaryLabel={t('dashboard.action.primary.post')}
              value={stat.posts}
            />
            <ActionCard
              icon={BookOpen}
              label={t('dashboard.action.label.notes')}
              onManage={() => navigate('/notes')}
              onPrimary={() => navigate('/notes/edit')}
              primaryLabel={t('dashboard.action.primary.note')}
              value={stat.notes}
            />
            <ActionCard
              icon={Pencil}
              label={t('dashboard.action.label.recently')}
              onManage={() => navigate('/recently')}
              onPrimary={() => navigate('/recently?create=1')}
              primaryLabel={t('dashboard.action.primary.recently')}
              value={stat.recently}
            />
            <ActionCard
              icon={Quote}
              label={t('dashboard.action.label.says')}
              onManage={() => navigate('/says')}
              onPrimary={() => navigate('/says')}
              primaryLabel={t('dashboard.action.primary.say')}
              value={stat.says}
            />
          </div>
        </Panel>

        <Panel className="mt-6" title={t('dashboard.panel.stats.title')}>
          <div className="grid gap-px bg-border-strong sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCell
              icon={File}
              label={t('dashboard.stat.pages')}
              onClick={() => navigate('/pages')}
              value={stat.pages}
            />
            <StatCell
              icon={Tags}
              label={t('dashboard.stat.categories')}
              onClick={() => navigate('/posts/category')}
              value={stat.categories}
            />
            <StatCell
              icon={MessageSquare}
              label={t('dashboard.stat.comments.all')}
              onClick={() => navigate('/comments?state=1')}
              value={stat.allComments ?? stat.comments}
            />
            <StatCell
              icon={MessageSquare}
              label={t('dashboard.stat.comments.unread')}
              onClick={() => navigate('/comments?state=0')}
              value={stat.unreadComments}
            />
            <StatCell
              icon={Link}
              label={t('dashboard.stat.friends.label')}
              onClick={() => navigate('/friends?state=0')}
              value={stat.links}
            />
            <StatCell
              icon={Link}
              label={t('dashboard.stat.friends.applications')}
              onClick={() => navigate('/friends?state=1')}
              value={stat.linkApply ?? 0}
            />
            <StatCell
              icon={Activity}
              label={t('dashboard.stat.apiCalls')}
              onClick={() => navigate('/analyze')}
              value={stat.callTime}
            />
            <StatCell
              icon={Gauge}
              label={t('dashboard.stat.todayIp')}
              onClick={() => navigate('/analyze')}
              value={stat.todayIpAccessCount}
            />
            <StatCell
              icon={FileText}
              label={t('dashboard.stat.wordCount')}
              value={wordCountQuery.data?.count ?? 0}
            />
            <StatCell
              icon={BookOpen}
              label={t('dashboard.stat.reads')}
              value={readLikeQuery.data?.totalReads ?? 0}
            />
            <StatCell
              icon={Heart}
              label={t('dashboard.stat.likes.post')}
              value={readLikeQuery.data?.totalLikes ?? 0}
            />
            <StatCell
              icon={Heart}
              label={t('dashboard.stat.likes.site')}
              value={siteLikeQuery.data ?? 0}
            />
            <StatCell
              icon={Clock3}
              label={t('dashboard.stat.uv')}
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
            title={t('dashboard.bar.publicationTrend.title')}
          />
          <BarPanel
            items={(categoryQuery.data ?? []).map((item) => ({
              label: item.name,
              value: item.count,
            }))}
            title={t('dashboard.stat.distribution')}
          />
          <BarPanel
            items={(commentActivityQuery.data ?? []).map((item) => ({
              label: item.date,
              value: item.count,
            }))}
            title={t('dashboard.bar.commentActivity.title')}
          />
          <TrafficPanel data={trafficSourceQuery.data} />
          <TopArticlesPanel articles={topArticlesQuery.data ?? []} />
          <TagCloudPanel tags={tagsQuery.data ?? []} />
        </section>

        <Panel className="mt-6" title={t('dashboard.panel.maintenance.title')}>
          <div className="grid gap-px bg-border-strong sm:grid-cols-2 xl:grid-cols-3">
            <MaintenanceCard
              disabled={cleanCacheMutation.isPending}
              icon={BrushCleaning}
              label={t('dashboard.maintenance.apiCache.label')}
              onClick={() => cleanCacheMutation.mutate()}
              value={t('dashboard.maintenance.apiCache.value')}
            />
            <MaintenanceCard
              disabled={cleanRedisMutation.isPending}
              icon={BrushCleaning}
              label={t('dashboard.maintenance.dataCache.label')}
              onClick={() => cleanRedisMutation.mutate()}
              value={t('dashboard.maintenance.dataCache.value')}
            />
            <SearchIndexRebuildCard
              forceLoading={
                rebuildSearchIndexMutation.isPending &&
                rebuildSearchIndexMutation.variables === true
              }
              incrementalLoading={
                rebuildSearchIndexMutation.isPending &&
                rebuildSearchIndexMutation.variables !== true
              }
              onForceRebuild={() => {
                if (
                  window.confirm(
                    t('dashboard.maintenance.searchIndex.forceConfirm'),
                  )
                ) {
                  rebuildSearchIndexMutation.mutate(true)
                }
              }}
              onIncrementalRebuild={() =>
                rebuildSearchIndexMutation.mutate(false)
              }
            />
          </div>
        </Panel>

        <OwnerLoginStat
          lastLoginIp={ownerQuery.data?.lastLoginIp}
          lastLoginTime={ownerQuery.data?.lastLoginTime}
        />

        <DashboardRuntimeFooter
          adminLatestVersion={updateQuery.data?.dashboard}
          adminVersion={adminVersion}
          onCheckUpdates={() => {
            void appInfoQuery.refetch()
            void updateQuery.refetch()
          }}
          onOpenUpgrade={() => presentDashboardUpgrade()}
          pageSource={window.pageSource || ''}
          refreshing={appInfoQuery.isFetching || updateQuery.isFetching}
          systemLatestVersion={updateQuery.data?.system}
          systemVersion={systemVersion}
        />
      </Scroll>
    </AppPage>
  )
}
