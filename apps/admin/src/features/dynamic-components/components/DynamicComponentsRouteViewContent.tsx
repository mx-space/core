import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { deleteDynamicComponentEntry } from '~/api/dynamic-components'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { Scroll } from '~/ui/primitives/scroll'

import { useComponentUsage } from '../hooks/use-component-usage'
import {
  useApplyDynamicCatalog,
  useDynamicCatalog,
} from '../hooks/use-dynamic-catalog'
import type { DynamicComponentItem } from '../types/dynamic-components'
import type { ComponentCleanupCandidate } from '../utils/component-usage'
import {
  openComponentCleanupDialog,
  useRunComponentCleanup,
} from './ComponentCleanupDialog'
import { DynamicComponentsRouteContext } from './dynamic-components-route-context'
import { presentDynamicComponentEditor } from './DynamicComponentEditorModal'
import { DynamicComponentList } from './DynamicComponentList'
import type { UsageFilter } from './DynamicComponentsHeader'
import {
  DynamicComponentsHeader,
  USAGE_FILTERS,
} from './DynamicComponentsHeader'
import {
  DynamicComponentDetailEmptyState,
  DynamicComponentListEmptyState,
  DynamicComponentListSkeleton,
} from './DynamicComponentStates'

const BASE_PATH = '/dynamic-components'

export function DynamicComponentsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { items, query } = useDynamicCatalog()
  const usageQuery = useComponentUsage(query.data)
  const report = usageQuery.data
  const applyCatalog = useApplyDynamicCatalog()
  const [search, setSearch] = useState('')

  const rawFilter = searchParams.get('usage')
  const filter: UsageFilter = USAGE_FILTERS.includes(rawFilter as UsageFilter)
    ? (rawFilter as UsageFilter)
    : 'all'
  const statusById = useMemo(
    () => new Map(report?.entries.map((entry) => [entry.entryId, entry])),
    [report],
  )
  const counts = useMemo(() => {
    const result: Record<UsageFilter, number> = {
      all: items.length,
      draftOnly: 0,
      unused: 0,
      used: 0,
    }
    for (const item of items) {
      const status = statusById.get(item.id)?.status
      if (status === 'used' || status === 'draftOnly' || status === 'unused')
        result[status]++
    }
    return result
  }, [items, statusById])

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return items.filter(
      (item) =>
        (filter === 'all' || statusById.get(item.id)?.status === filter) &&
        (!keyword ||
          item.name.toLowerCase().includes(keyword) ||
          item.url.toLowerCase().includes(keyword)),
    )
  }, [filter, items, search, statusById])

  const refreshAll = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.dynamicComponents.root,
      }),
    [queryClient],
  )
  const closeDetail = useCallback(() => navigate(BASE_PATH), [navigate])

  const openEditor = useCallback(
    async (item: DynamicComponentItem | null) => {
      const result = await presentDynamicComponentEditor(item)
      if (!result) return
      applyCatalog(result.catalog)
      const saved = result.catalog.components.find(
        (entry) => entry.url === result.url,
      )
      if (saved?.id) navigate(`${BASE_PATH}/${encodeURIComponent(saved.id)}`)
    },
    [applyCatalog, navigate],
  )

  const deleteMutation = useMutation({
    mutationFn: deleteDynamicComponentEntry,
    onError: () => {
      toast.error(t('dynamicComponents.toast.deleteFailed'))
    },
    onSuccess: (catalog) => {
      applyCatalog(catalog)
      toast.success(t('dynamicComponents.toast.deleted'))
      closeDetail()
    },
  })
  const versionCleanup = useRunComponentCleanup(() => void refreshAll())

  const ctxValue = useMemo(
    () => ({
      deletingKey: versionCleanup.isPending
        ? (versionCleanup.variables?.[0]?.key ?? null)
        : null,
      onBack: closeDetail,
      onDelete: async (item: DynamicComponentItem) => {
        const confirmed = await confirmDialog({
          confirmText: t('common.delete'),
          description: t('dynamicComponents.delete.description'),
          destructive: true,
          title: t('dynamicComponents.delete.title', { name: item.name }),
        })
        if (confirmed) deleteMutation.mutate(item.id)
      },
      onDeleteCandidate: (candidate: ComponentCleanupCandidate) =>
        versionCleanup.mutate([candidate]),
      onEdit: (item: DynamicComponentItem) => void openEditor(item),
      usage: report,
    }),
    [closeDetail, deleteMutation, openEditor, report, t, versionCleanup],
  )

  const openCleanup = () => {
    if (!report) return
    void openComponentCleanupDialog(report).then((result) => {
      if (result) void refreshAll()
    })
  }

  return (
    <DynamicComponentsRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        emptyDetail={<DynamicComponentDetailEmptyState />}
        header={
          <DynamicComponentsHeader
            counts={counts}
            filter={filter}
            onCleanup={openCleanup}
            onCreate={() => void openEditor(null)}
            onFilterChange={(next) =>
              setSearchParams(
                (current) => {
                  const nextParams = new URLSearchParams(current)
                  if (next === 'all') nextParams.delete('usage')
                  else nextParams.set('usage', next)
                  return nextParams
                },
                { replace: true },
              )
            }
            onRefresh={() => void refreshAll()}
            onSearchChange={setSearch}
            refreshing={query.isFetching || usageQuery.isFetching}
            report={report}
            search={search}
            total={items.length}
            usageState={
              usageQuery.isError
                ? 'error'
                : usageQuery.isPending
                  ? 'loading'
                  : 'ready'
            }
          />
        }
        list={
          <Scroll className="h-full">
            {query.isLoading && items.length === 0 ? (
              <DynamicComponentListSkeleton />
            ) : items.length === 0 ? (
              <DynamicComponentListEmptyState
                onCreate={() => void openEditor(null)}
              />
            ) : visibleItems.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-fg-subtle">
                {t('dynamicComponents.noMatch')}
              </p>
            ) : (
              <DynamicComponentList
                items={visibleItems}
                onSelect={(item) =>
                  navigate({
                    pathname: `${BASE_PATH}/${encodeURIComponent(item.id)}`,
                    search: searchParams.toString(),
                  })
                }
                reports={statusById}
                selectedId={params.id ?? null}
              />
            )}
          </Scroll>
        }
      />
    </DynamicComponentsRouteContext.Provider>
  )
}
