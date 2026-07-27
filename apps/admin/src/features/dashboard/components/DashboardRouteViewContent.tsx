import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, Pencil, Quote, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { getAggregateStat } from '~/api/aggregate'
import { checkUpdateFromGitHub } from '~/api/github-update'
import { getOwner } from '~/api/options'
import { getAppInfo } from '~/api/system'
import { useI18n } from '~/i18n'
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
import { readClosedUpdateTips, writeClosedUpdateTip } from '../utils/dashboard'
import { ActionCard } from './ActionCard'
import { DashboardRuntimeFooter } from './DashboardRuntimeFooter'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { OwnerLoginStat } from './OwnerLoginStat'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DashboardRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const notifiedUpdatesRef = useRef(new Set<string>())
  const statQuery = useQuery({
    queryFn: getAggregateStat,
    queryKey: dashboardQueryKeys.aggregateStat,
    refetchInterval: aggregateStatRefetchInterval,
  })
  const stat = statQuery.data ?? defaultStat
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
        <Panel
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
