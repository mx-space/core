import { useMutation } from '@tanstack/react-query'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { deleteDynamicComponentEntry } from '~/api/dynamic-components'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import {
  useApplyDynamicCatalog,
  useDynamicCatalog,
} from '../hooks/use-dynamic-catalog'
import type { DynamicComponentItem } from '../types/dynamic-components'
import { DynamicComponentsRouteContext } from './dynamic-components-route-context'
import { presentDynamicComponentEditor } from './DynamicComponentEditorModal'
import { DynamicComponentList } from './DynamicComponentList'
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
  const { items, query } = useDynamicCatalog()
  const applyCatalog = useApplyDynamicCatalog()
  const [search, setSearch] = useState('')

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.url.toLowerCase().includes(keyword),
    )
  }, [items, search])

  const closeDetail = useCallback(() => {
    navigate(BASE_PATH)
  }, [navigate])

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

  const ctxValue = useMemo(
    () => ({
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
      onEdit: (item: DynamicComponentItem) => void openEditor(item),
    }),
    [closeDetail, deleteMutation, openEditor, t],
  )

  return (
    <DynamicComponentsRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        emptyDetail={<DynamicComponentDetailEmptyState />}
        list={
          <section className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <span className="truncate text-sm font-semibold text-fg">
                  {t('dynamicComponents.title')}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {t('dynamicComponents.count', { count: items.length })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  aria-label={t('dynamicComponents.refreshAria')}
                  className="h-8 px-2"
                  onClick={() => void query.refetch()}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                </Button>
                <Button
                  className="h-8 px-2"
                  onClick={() => void openEditor(null)}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  {t('dynamicComponents.add')}
                </Button>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="relative shrink-0 border-b border-neutral-100 px-4 py-2 dark:border-neutral-900">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
                />
                <TextInput
                  aria-label={t('dynamicComponents.searchPlaceholder')}
                  controlClassName="pl-8"
                  onChange={setSearch}
                  placeholder={t('dynamicComponents.searchPlaceholder')}
                  type="search"
                  value={search}
                />
              </div>
            ) : null}

            <Scroll className="flex-1">
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
                    navigate(`${BASE_PATH}/${encodeURIComponent(item.id)}`)
                  }
                  selectedId={params.id ?? null}
                />
              )}
            </Scroll>
          </section>
        }
      />
    </DynamicComponentsRouteContext.Provider>
  )
}
