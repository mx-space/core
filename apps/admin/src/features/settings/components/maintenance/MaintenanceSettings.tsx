import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BrushCleaning, Wrench } from 'lucide-react'
import { toast } from 'sonner'

import { cleanCache, cleanRedis } from '~/api/aggregate'
import { rebuildSearchIndex } from '~/api/search-index'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { formatSearchIndexStats, getErrorMessage } from '../../utils/settings'
import { SettingsSection } from '../SettingsPrimitives'
import { MaintenanceCard } from './MaintenanceCard'
import { SearchIndexRebuildCard } from './SearchIndexRebuildCard'

export function MaintenanceSettings() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const cleanCacheMutation = useMutation({
    mutationFn: cleanCache,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(
          error,
          t('settings.maintenance.toast.apiCacheClearError'),
        ),
      ),
    onSuccess: () =>
      toast.success(t('settings.maintenance.toast.apiCacheCleared')),
  })
  const cleanRedisMutation = useMutation({
    mutationFn: cleanRedis,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(
          error,
          t('settings.maintenance.toast.dataCacheClearError'),
        ),
      ),
    onSuccess: () =>
      toast.success(t('settings.maintenance.toast.dataCacheCleared')),
  })
  const rebuildSearchIndexMutation = useMutation({
    mutationFn: rebuildSearchIndex,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(
          error,
          t('settings.maintenance.searchIndex.rebuildError'),
        ),
      ),
    onSuccess: async (result) => {
      toast.success(formatSearchIndexStats(result))
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.searchIndex.root,
      })
    },
  })

  return (
    <SettingsSection
      description={t('settings.group.maintenance.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <Wrench aria-hidden="true" className="size-4" />
          {t('settings.group.maintenance.title')}
        </span>
      }
    >
      <div className="grid gap-px bg-border-strong sm:grid-cols-2 xl:grid-cols-3">
        <MaintenanceCard
          disabled={cleanCacheMutation.isPending}
          icon={BrushCleaning}
          label={t('settings.maintenance.apiCache.label')}
          onClick={() => cleanCacheMutation.mutate()}
          value={t('settings.maintenance.apiCache.value')}
        />
        <MaintenanceCard
          disabled={cleanRedisMutation.isPending}
          icon={BrushCleaning}
          label={t('settings.maintenance.dataCache.label')}
          onClick={() => cleanRedisMutation.mutate()}
          value={t('settings.maintenance.dataCache.value')}
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
              window.confirm(t('settings.maintenance.searchIndex.forceConfirm'))
            ) {
              rebuildSearchIndexMutation.mutate(true)
            }
          }}
          onIncrementalRebuild={() => rebuildSearchIndexMutation.mutate(false)}
        />
      </div>
    </SettingsSection>
  )
}
