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
import { useI18n } from '~/i18n'
import { AppPage } from '~/ui/layout/page-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Scroll } from '~/ui/primitives/scroll'
import { isNewerVersion } from '~/utils/version'

import {
  aggregateStatRefetchInterval,
  dashboardQueryKeys,
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
import { DeskRhythmCard } from './DeskRhythmCard'
import { DeskStatBand } from './DeskStatBand'
import { DeskTasksCard } from './DeskTasksCard'
import { DeskTopArticlesCard } from './DeskTopArticlesCard'
import { DeskTrafficCard } from './DeskTrafficCard'
import { DeskWritingCard } from './DeskWritingCard'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DashboardRouteViewContent() {
  const { t } = useI18n()
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
  const hasCards = writingItems.length > 0 || hasTasks
  const hasLoadError = deskQuery.isError || draftsQuery.isError
  const showZen = deskQuery.isSuccess && draftsQuery.isSuccess && !hasCards

  const onThisDayEntries = onThisDayQuery.data ?? []
  const echoRows = useMemo(
    () =>
      buildEchoRows(
        recentActivitiesQuery.data?.comment ?? [],
        recentActivitiesQuery.data?.like ?? [],
        t,
      ),
    [recentActivitiesQuery.data, t],
  )
  return (
    <AppPage>
      <Scroll
        className="min-h-0 flex-1 bg-background"
        innerClassName="flex min-h-full flex-col p-4 pt-6 desktop:px-8 desktop:pt-10"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 phone:gap-6">
          <DeskGreeting
            online={statQuery.data?.online}
            ownerName={ownerQuery.data?.name}
            todayMaxOnline={statQuery.data?.todayMaxOnline}
          />

          <DeskStatBand
            pendingComments={desk?.unreadComments.count}
            stat={statQuery.data}
            totalReads={readLikeQuery.data?.totalReads}
          />

          {hasLoadError ? (
            <DeskLoadError
              onRetry={() => {
                if (deskQuery.isError) void deskQuery.refetch()
                if (draftsQuery.isError) void draftsQuery.refetch()
              }}
              retrying={deskQuery.isFetching || draftsQuery.isFetching}
            />
          ) : null}

          <div className="grid flex-1 gap-4 phone:gap-6 desktop:grid-cols-[8fr_4fr]">
            <div className="flex min-w-0 flex-col gap-4 phone:gap-6">
              {writingItems.length > 0 ? (
                <DeskWritingCard items={writingItems} />
              ) : null}
              {showZen ? (
                <EmptyState icon={Leaf} title={t('dashboard.desk.zen.title')} />
              ) : null}
              <DeskRhythmCard days={heatmapQuery.data ?? []} />
              <div className="grid items-start gap-4 phone:gap-6 desktop:grid-cols-2">
                <DeskOnThisDayCard entries={onThisDayEntries} />
                <DeskTopArticlesCard articles={topArticlesQuery.data ?? []} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-4 phone:gap-6">
              {hasTasks ? (
                <DeskTasksCard
                  adminUpdate={adminUpdate}
                  adminVersion={adminVersion}
                  desk={desk}
                  systemUpdate={systemUpdate}
                  systemVersion={systemVersion}
                />
              ) : null}
              <DeskTrafficCard today={analyzeAggregateQuery.data?.today} />
              {echoRows.length > 0 ? <DeskEchoCard rows={echoRows} /> : null}
            </div>
          </div>

          <DeskFooter
            adminVersion={adminVersion}
            onCheckUpdates={() => void handleCheckUpdates()}
            refreshing={appInfoQuery.isFetching || updateQuery.isFetching}
            systemVersion={systemVersion}
          />
        </div>
      </Scroll>
    </AppPage>
  )
}
