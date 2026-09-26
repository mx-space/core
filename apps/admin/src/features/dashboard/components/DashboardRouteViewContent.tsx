import { useQuery } from '@tanstack/react-query'
import { Leaf } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { getRecentActivities } from '~/api/activity'
import {
  countReadAndLike,
  getAggregateStat,
  getDesk,
  getOnThisDay,
  getPublishHeatmap,
  getTopArticles,
} from '~/api/aggregate'
import { getAnalyzeAggregate } from '~/api/analyze'
import { getDrafts } from '~/api/drafts'
import {
  checkUpdateFromGitHub,
  type GitHubUpdateVersions,
} from '~/api/github-update'
import { getOwner } from '~/api/options'
import { getAppInfo } from '~/api/system'
import { useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { AppPage } from '~/ui/layout/page-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Scroll } from '~/ui/primitives/scroll'
import { isNewerVersion } from '~/utils/version'

import {
  aggregateStatRefetchInterval,
  dashboardQueryKeys,
  deskSplitMediaQuery,
  deskWritingItemLimit,
  updateStaleTime,
} from '../constants'
import { readClosedUpdateTips, writeClosedUpdateTip } from '../utils/dashboard'
import { buildWritingItems } from '../utils/desk'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { buildEchoRows, DeskEchoCard } from './DeskEchoCard'
import { DeskFooter } from './DeskFooter'
import { DeskGreeting } from './DeskGreeting'
import { DeskLoadError } from './DeskLoadError'
import { DeskOnThisDayCard } from './DeskOnThisDayCard'
import { DeskResumeCard } from './DeskResumeCard'
import { DeskRhythmCard } from './DeskRhythmCard'
import { DeskStatBand } from './DeskStatBand'
import { DeskTasksCard } from './DeskTasksCard'
import { DeskTopArticlesCard } from './DeskTopArticlesCard'
import { DeskTrafficCard } from './DeskTrafficCard'
import { DeskWeekCard } from './DeskWeekCard'
import { DeskWritingCard } from './DeskWritingCard'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DashboardRouteViewContent() {
  const { t } = useI18n()
  const split = useMediaQuery(deskSplitMediaQuery)
  const notifiedUpdatesRef = useRef(new Set<string>())

  const statQuery = useQuery({
    queryFn: getAggregateStat,
    queryKey: dashboardQueryKeys.aggregateStat,
    refetchInterval: aggregateStatRefetchInterval,
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
  const deskQuery = useQuery({
    queryFn: getDesk,
    queryKey: dashboardQueryKeys.desk,
  })
  const draftsQuery = useQuery({
    queryFn: () =>
      getDrafts({
        page: 1,
        size: deskWritingItemLimit,
        sort_by: 'updatedAt',
        sort_order: 'desc',
      }),
    queryKey: dashboardQueryKeys.deskDrafts,
  })
  const readLikeQuery = useQuery({
    queryFn: countReadAndLike,
    queryKey: dashboardQueryKeys.readLike,
  })
  const onThisDayQuery = useQuery({
    queryFn: getOnThisDay,
    queryKey: dashboardQueryKeys.onThisDay,
  })
  const heatmapQuery = useQuery({
    queryFn: getPublishHeatmap,
    queryKey: dashboardQueryKeys.publishHeatmap,
  })
  const recentActivitiesQuery = useQuery({
    queryFn: getRecentActivities,
    queryKey: dashboardQueryKeys.recentActivities,
  })
  const analyzeAggregateQuery = useQuery({
    queryFn: getAnalyzeAggregate,
    queryKey: dashboardQueryKeys.analyzeAggregate,
  })
  const topArticlesQuery = useQuery({
    queryFn: getTopArticles,
    queryKey: dashboardQueryKeys.topArticles,
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

  const resolveUpdates = (versions: GitHubUpdateVersions | undefined) => ({
    adminUpdate:
      versions && isNewerVersion(adminVersion, versions.dashboard)
        ? versions.dashboard
        : null,
    systemUpdate:
      versions && isNewerVersion(systemVersion, versions.system)
        ? versions.system
        : null,
  })
  const { adminUpdate, systemUpdate } = resolveUpdates(updateQuery.data)

  const notifyUpdates = (
    versions: GitHubUpdateVersions | undefined,
    force: boolean,
  ) => {
    if (!versions) return false
    const closedTips = readClosedUpdateTips()
    const { adminUpdate, systemUpdate } = resolveUpdates(versions)

    if (
      adminUpdate &&
      (force ||
        (closedTips.dashboard !== adminUpdate &&
          !notifiedUpdatesRef.current.has(`dashboard:${adminUpdate}`)))
    ) {
      notifiedUpdatesRef.current.add(`dashboard:${adminUpdate}`)
      toast.info(
        t('dashboard.update.adminAvailable', {
          current: adminVersion,
          latest: adminUpdate,
        }),
        {
          action: {
            label: t('dashboard.update.update'),
            onClick: () => {
              writeClosedUpdateTip('dashboard', adminUpdate)
              presentDashboardUpgrade()
            },
          },
          duration: 10_000,
        },
      )
    }

    if (
      systemUpdate &&
      (force ||
        (closedTips.system !== systemUpdate &&
          !notifiedUpdatesRef.current.has(`system:${systemUpdate}`)))
    ) {
      notifiedUpdatesRef.current.add(`system:${systemUpdate}`)
      toast.info(
        t('dashboard.update.systemAvailable', {
          current: systemVersion,
          latest: systemUpdate,
        }),
        {
          action: {
            label: t('common.view'),
            onClick: () => {
              writeClosedUpdateTip('system', systemUpdate)
              presentUpdateRelease({
                repo: 'mx-server',
                title: t('dashboard.release.systemTitle'),
                version: systemUpdate,
              })
            },
          },
          duration: 10_000,
        },
      )
    }

    return Boolean(adminUpdate || systemUpdate)
  }

  useEffect(() => {
    if (__DEV__) return
    if (appInfoQuery.data?.version?.startsWith('demo')) {
      toast.info(t('dashboard.demoMode.tip'))
    }
  }, [appInfoQuery.data?.version])

  useEffect(() => {
    if (__DEV__) return
    notifyUpdates(updateQuery.data, false)
  }, [updateQuery.data, adminVersion, systemVersion])

  const handleCheckUpdates = async () => {
    const [, result] = await Promise.all([
      appInfoQuery.refetch(),
      updateQuery.refetch(),
    ])
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    if (!notifyUpdates(result.data, true)) {
      toast.success(t('dashboard.update.upToDate'))
    }
  }

  const desk = deskQuery.data
  const writingItems = useMemo(
    () =>
      buildWritingItems(
        draftsQuery.data?.data ?? [],
        desk?.scheduledNotes ?? [],
      ),
    [desk?.scheduledNotes, draftsQuery.data?.data],
  )
  const hasTasks =
    (desk?.unreadComments.count ?? 0) > 0 ||
    (desk?.linkApplications.count ?? 0) > 0 ||
    adminUpdate !== null ||
    systemUpdate !== null
  const resumeItem = writingItems.find((item) => item.draftId !== null)
  const restItems = writingItems.filter((item) => item !== resumeItem)
  const hasCards = writingItems.length > 0 || hasTasks
  const hasLoadError = deskQuery.isError || draftsQuery.isError
  const showZen = deskQuery.isSuccess && draftsQuery.isSuccess && !hasCards

  const onThisDayEntries = onThisDayQuery.data ?? []
  const topArticles = topArticlesQuery.data ?? []
  const echoRows = useMemo(
    () =>
      buildEchoRows(
        recentActivitiesQuery.data?.comment ?? [],
        recentActivitiesQuery.data?.like ?? [],
        t,
      ),
    [recentActivitiesQuery.data, t],
  )
  const primary = (
    <>
      <DeskGreeting
        className="phone:order-1"
        desk={desk}
        online={statQuery.data?.online}
        ownerName={ownerQuery.data?.name}
        todayMaxOnline={statQuery.data?.todayMaxOnline}
      />

      {hasLoadError ? (
        <div className="pb-6 phone:order-1">
          <DeskLoadError
            onRetry={() => {
              if (deskQuery.isError) void deskQuery.refetch()
              if (draftsQuery.isError) void draftsQuery.refetch()
            }}
            retrying={deskQuery.isFetching || draftsQuery.isFetching}
          />
        </div>
      ) : null}

      {resumeItem ? (
        <DeskResumeCard className="phone:order-3" item={resumeItem} />
      ) : null}
      {showZen ? (
        <div className="border-t border-border py-7 phone:order-3 phone:py-6">
          <EmptyState icon={Leaf} title={t('dashboard.desk.zen.title')} />
        </div>
      ) : null}
      {restItems.length > 0 ? (
        <DeskWritingCard
          className="phone:order-4"
          items={restItems}
          total={writingItems.length}
        />
      ) : null}

      {onThisDayEntries.length > 0 || topArticles.length > 0 ? (
        <div className="grid gap-x-10 gap-y-6 border-t border-border py-7 @3xl/desk:grid-cols-2 phone:order-8 phone:py-6">
          {onThisDayEntries.length > 0 ? (
            <DeskOnThisDayCard entries={onThisDayEntries} />
          ) : null}
          {topArticles.length > 0 ? (
            <DeskTopArticlesCard articles={topArticles} />
          ) : null}
        </div>
      ) : null}
      <DeskRhythmCard
        className="phone:order-9"
        days={heatmapQuery.data ?? []}
      />
      <DeskStatBand
        className="phone:order-10"
        pendingComments={desk?.unreadComments.count}
        stat={statQuery.data}
        totalReads={readLikeQuery.data?.totalReads}
      />

      <DeskFooter
        adminVersion={adminVersion}
        className="phone:order-11"
        onCheckUpdates={() => void handleCheckUpdates()}
        refreshing={appInfoQuery.isFetching || updateQuery.isFetching}
        systemVersion={systemVersion}
      />
    </>
  )
  const rail = (
    <>
      <DeskWeekCard
        className="phone:order-5"
        days={heatmapQuery.data ?? []}
        scheduledNotes={desk?.scheduledNotes ?? []}
      />
      {hasTasks ? (
        <DeskTasksCard
          adminUpdate={adminUpdate}
          adminVersion={adminVersion}
          className="phone:order-2"
          desk={desk}
          systemUpdate={systemUpdate}
          systemVersion={systemVersion}
        />
      ) : null}
      <DeskTrafficCard
        className="phone:order-6"
        today={analyzeAggregateQuery.data?.today}
      />
      {echoRows.length > 0 ? (
        <DeskEchoCard className="phone:order-7" rows={echoRows} />
      ) : null}
    </>
  )

  return (
    <AppPage>
      {split ? (
        <div className="flex min-h-0 flex-1">
          <Scroll
            className="min-h-0 min-w-0 flex-1 bg-background"
            innerClassName="flex min-h-full flex-col px-16 pb-10 pt-12"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
              {primary}
            </div>
          </Scroll>
          <Scroll
            className="min-h-0 w-[300px] shrink-0 border-l border-border bg-background"
            innerClassName="px-7 pb-6 pt-6"
          >
            <aside>{rail}</aside>
          </Scroll>
        </div>
      ) : (
        <Scroll
          className="min-h-0 flex-1 bg-background"
          innerClassName="@container/desk flex min-h-full flex-col"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col phone:px-4 phone:pb-8 phone:pt-5">
            <div className="flex min-w-0 flex-1 flex-col px-6 pb-10 pt-12 @3xl/desk:px-12 phone:contents">
              {primary}
            </div>
            <aside className="grid min-w-0 content-start gap-x-10 border-t border-border px-6 pb-10 @3xl/desk:grid-cols-2 @3xl/desk:px-12 phone:contents">
              {rail}
            </aside>
          </div>
        </Scroll>
      )}
    </AppPage>
  )
}
