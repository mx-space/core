import { useQuery } from '@tanstack/react-query'
import { Leaf } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { getAggregateStat, getDashboard } from '~/api/aggregate'
import {
  checkUpdateFromGitHub,
  type GitHubUpdateVersions,
} from '~/api/github-update'
import { getAppInfo } from '~/api/system'
import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { isNewerVersion } from '~/utils/version'

import {
  aggregateStatRefetchInterval,
  dashboardQueryKeys,
  updateStaleTime,
} from '../constants'
import { readClosedUpdateTips, writeClosedUpdateTip } from '../utils/dashboard'
import { buildWritingItems } from '../utils/desk'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { buildEchoRows, DeskEchoCard } from './DeskEchoCard'
import { DeskFooter } from './DeskFooter'
import { DeskGreeting } from './DeskGreeting'
import { DeskLayout } from './DeskLayout'
import { DeskLoadError } from './DeskLoadError'
import { DeskOnThisDayCard } from './DeskOnThisDayCard'
import { DeskResumeCard } from './DeskResumeCard'
import { DeskRhythmCard } from './DeskRhythmCard'
import { DeskPrimarySkeleton, DeskRailSkeleton } from './DeskSkeleton'
import { DeskStatBand } from './DeskStatBand'
import { DeskTasksCard } from './DeskTasksCard'
import { DeskTopArticlesCard } from './DeskTopArticlesCard'
import { DeskTrafficCard } from './DeskTrafficCard'
import { DeskWeekCard } from './DeskWeekCard'
import { DeskWritingCard } from './DeskWritingCard'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DashboardRouteViewContent() {
  const { t } = useI18n()
  const notifiedUpdatesRef = useRef(new Set<string>())

  const dashboardQuery = useQuery({
    queryFn: getDashboard,
    queryKey: dashboardQueryKeys.home,
  })
  const statQuery = useQuery({
    queryFn: getAggregateStat,
    queryKey: dashboardQueryKeys.aggregateStat,
    refetchInterval: aggregateStatRefetchInterval,
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

  const home = dashboardQuery.data
  const desk = home?.desk
  const stat = statQuery.data ?? home?.stat
  const writingItems = useMemo(
    () => buildWritingItems(home?.drafts ?? [], desk?.scheduledNotes ?? []),
    [desk?.scheduledNotes, home?.drafts],
  )
  const echoRows = useMemo(
    () => buildEchoRows(home?.recent.comment ?? [], home?.recent.like ?? [], t),
    [home?.recent, t],
  )

  if (!home) {
    return (
      <DeskLayout
        primary={
          dashboardQuery.isError ? (
            <DeskLoadError
              onRetry={() => void dashboardQuery.refetch()}
              retrying={dashboardQuery.isFetching}
            />
          ) : (
            <DeskPrimarySkeleton />
          )
        }
        rail={dashboardQuery.isError ? null : <DeskRailSkeleton />}
      />
    )
  }

  const hasTasks =
    home.desk.unreadComments.count > 0 ||
    home.desk.linkApplications.count > 0 ||
    adminUpdate !== null ||
    systemUpdate !== null
  const resumeItem = writingItems.find((item) => item.draftId !== null)
  const restItems = writingItems.filter((item) => item !== resumeItem)
  const showZen = writingItems.length === 0 && !hasTasks

  return (
    <DeskLayout
      primary={
        <>
          <DeskGreeting
            className="phone:order-1"
            desk={home.desk}
            online={stat?.online}
            ownerName={home.ownerName ?? undefined}
            todayMaxOnline={stat?.todayMaxOnline}
          />

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

          {home.onThisDay.length > 0 || home.topArticles.length > 0 ? (
            <div className="grid gap-x-10 gap-y-6 border-t border-border py-7 @3xl/desk:grid-cols-2 phone:order-8 phone:py-6">
              {home.onThisDay.length > 0 ? (
                <DeskOnThisDayCard entries={home.onThisDay} />
              ) : null}
              {home.topArticles.length > 0 ? (
                <DeskTopArticlesCard articles={home.topArticles} />
              ) : null}
            </div>
          ) : null}
          <DeskRhythmCard
            className="phone:order-9"
            days={home.publishHeatmap}
          />
          <DeskStatBand
            className="phone:order-10"
            pendingComments={home.desk.unreadComments.count}
            stat={stat}
            totalReads={home.reads.totalReads}
          />

          <DeskFooter
            adminVersion={adminVersion}
            className="phone:order-11"
            onCheckUpdates={() => void handleCheckUpdates()}
            refreshing={appInfoQuery.isFetching || updateQuery.isFetching}
            systemVersion={systemVersion}
          />
        </>
      }
      rail={
        <>
          <DeskWeekCard
            className="phone:order-5"
            days={home.publishHeatmap}
            scheduledNotes={home.desk.scheduledNotes}
          />
          {hasTasks ? (
            <DeskTasksCard
              adminUpdate={adminUpdate}
              adminVersion={adminVersion}
              className="phone:order-2"
              desk={home.desk}
              systemUpdate={systemUpdate}
              systemVersion={systemVersion}
            />
          ) : null}
          <DeskTrafficCard className="phone:order-6" />
          {echoRows.length > 0 ? (
            <DeskEchoCard className="phone:order-7" rows={echoRows} />
          ) : null}
        </>
      }
    />
  )
}
