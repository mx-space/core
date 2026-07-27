import { useQuery } from '@tanstack/react-query'
import { Leaf } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { getAggregateStat, getDesk } from '~/api/aggregate'
import { getDrafts } from '~/api/drafts'
import { checkUpdateFromGitHub } from '~/api/github-update'
import { getOwner } from '~/api/options'
import { getAppInfo } from '~/api/system'
import { useI18n } from '~/i18n'
import { AppPage } from '~/ui/layout/page-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
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
import { DeskFooter } from './DeskFooter'
import { DeskGreeting } from './DeskGreeting'
import { DeskLoadError } from './DeskLoadError'
import { DeskTasksCard } from './DeskTasksCard'
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

  const updates = updateQuery.data
  const adminUpdate =
    updates && isNewerVersion(adminVersion, updates.dashboard)
      ? updates.dashboard
      : null
  const systemUpdate =
    updates && isNewerVersion(systemVersion, updates.system)
      ? updates.system
      : null

  useEffect(() => {
    if (__DEV__) return
    if (appInfoQuery.data?.version?.startsWith('demo')) {
      toast.info(t('dashboard.demoMode.tip'))
    }
  }, [appInfoQuery.data?.version])

  useEffect(() => {
    if (__DEV__) return
    const closedTips = readClosedUpdateTips()

    if (
      adminUpdate &&
      closedTips.dashboard !== adminUpdate &&
      !notifiedUpdatesRef.current.has(`dashboard:${adminUpdate}`)
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
      closedTips.system !== systemUpdate &&
      !notifiedUpdatesRef.current.has(`system:${systemUpdate}`)
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
  }, [adminUpdate, adminVersion, systemUpdate, systemVersion])

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

  return (
    <AppPage>
      <Scroll
        className="min-h-0 flex-1 bg-background"
        innerClassName="flex min-h-full flex-col gap-6 p-4"
      >
        <DeskGreeting ownerName={ownerQuery.data?.name} />

        {hasCards ? (
          <div
            className={cn(
              'grid gap-4',
              writingItems.length > 0 &&
                hasTasks &&
                'desktop:grid-cols-[5fr_3fr]',
            )}
          >
            {writingItems.length > 0 ? (
              <DeskWritingCard items={writingItems} />
            ) : null}
            {hasTasks ? (
              <DeskTasksCard
                adminUpdate={adminUpdate}
                adminVersion={adminVersion}
                desk={desk}
                systemUpdate={systemUpdate}
                systemVersion={systemVersion}
              />
            ) : null}
          </div>
        ) : null}

        {hasLoadError ? (
          <DeskLoadError
            onRetry={() => {
              if (deskQuery.isError) void deskQuery.refetch()
              if (draftsQuery.isError) void draftsQuery.refetch()
            }}
            retrying={deskQuery.isFetching || draftsQuery.isFetching}
          />
        ) : null}

        {showZen ? (
          <EmptyState icon={Leaf} title={t('dashboard.desk.zen.title')} />
        ) : null}

        <DeskFooter
          adminVersion={adminVersion}
          onCheckUpdates={() => {
            void appInfoQuery.refetch()
            void updateQuery.refetch()
          }}
          online={statQuery.data?.online ?? 0}
          refreshing={appInfoQuery.isFetching || updateQuery.isFetching}
          systemVersion={systemVersion}
          todayMaxOnline={statQuery.data?.todayMaxOnline ?? 0}
          todayVisitors={statQuery.data?.todayOnlineTotal ?? 0}
        />
      </Scroll>
    </AppPage>
  )
}
