import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Hammer,
  Layers,
  Loader2,
  Search,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type {
  SearchDocumentAdminRow,
  SearchIndexRefType,
} from '~/api/search-index'
import {
  rebuildSearchIndex,
  rebuildSearchIndexDocument,
} from '~/api/search-index'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import {
  refTypeOptionKeys,
  searchIndexPageSizeOptions,
  searchIndexQueryKey,
} from '../constants'
import { useSearchIndexDocuments } from '../hooks/use-search-index-documents'
import { getErrorMessage } from '../utils/format'
import { SearchIndexRouteContext } from './search-index-route-context'
import { SearchIndexDetailEmptyState } from './SearchIndexDetailEmptyState'
import { SearchIndexEmptyState } from './SearchIndexEmptyState'
import { SearchIndexRow } from './SearchIndexRow'
import { SearchIndexSkeleton } from './SearchIndexSkeleton'

const FOCUS_SCOPE_ID = 'search-index'

export function SearchIndexRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const selectedId = params.id ?? null
  const {
    documentsQuery,
    keyword,
    keywordInput,
    langFilter,
    listQueryString,
    page,
    pageCount,
    pageSize,
    refTypeFilter,
    rows,
    setKeywordInput,
    setLangFilter,
    setPage,
    setPageSize,
    setRefTypeFilter,
    total,
  } = useSearchIndexDocuments()

  const closeDetail = useCallback(() => {
    navigate(
      `/maintenance/search-index${listQueryString ? `?${listQueryString}` : ''}`,
    )
  }, [listQueryString, navigate])

  const openRow = useCallback(
    (id: string) => {
      navigate(
        `/maintenance/search-index/${encodeURIComponent(id)}${listQueryString ? `?${listQueryString}` : ''}`,
      )
    },
    [listQueryString, navigate],
  )

  const refTypeOptions = refTypeOptionKeys.map((opt) => ({
    label: t(opt.labelKey),
    value: opt.value,
  }))

  useListKeyboard({
    actions: [],
    getId: (row) => row.id,
    items: rows,
    onItemFocus: (id) => openRow(id),
    resetOn: [refTypeFilter, langFilter, keyword, page, pageSize],
    scopeId: FOCUS_SCOPE_ID,
  })

  const rebuildAllMutation = useMutation({
    mutationFn: rebuildSearchIndex,
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('searchIndex.toast.rebuildFailed')))
    },
    onSuccess: async (result, force) => {
      toast.success(
        t('searchIndex.toast.rebuildAllDone', {
          created: result.created,
          deleted: result.deleted,
          scope: force
            ? t('searchIndex.scope.full')
            : t('searchIndex.scope.incremental'),
          skipped: result.skipped,
          total: result.total,
          updated: result.updated,
        }),
      )
      await queryClient.invalidateQueries({ queryKey: searchIndexQueryKey })
    },
  })

  const rebuildOneMutation = useMutation({
    mutationFn: (row: SearchDocumentAdminRow) =>
      rebuildSearchIndexDocument(row.refType, row.refId),
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t('searchIndex.toast.rebuildFailed')))
    },
    onSuccess: async (result) => {
      toast.success(
        t('searchIndex.toast.rebuildOneDone', { count: result.rebuilt }),
      )
      await queryClient.invalidateQueries({ queryKey: searchIndexQueryKey })
    },
  })

  const routeContextValue = useMemo(
    () => ({
      onBack: closeDetail,
      onRebuild: (row: SearchDocumentAdminRow) =>
        rebuildOneMutation.mutate(row),
      isRebuilding: (id: string) =>
        rebuildOneMutation.isPending && rebuildOneMutation.variables?.id === id,
    }),
    [closeDetail, rebuildOneMutation],
  )

  return (
    <SearchIndexRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<SearchIndexDetailEmptyState />}
        onDismiss={closeDetail}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                  <span className="truncate">{t('searchIndex.title')}</span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {total}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t('searchIndex.action.incrementalRebuild')}
                  disabled={rebuildAllMutation.isPending}
                  iconOnly
                  onClick={() => {
                    if (window.confirm(t('searchIndex.confirm.incremental'))) {
                      rebuildAllMutation.mutate(false)
                    }
                  }}
                  title={t('searchIndex.action.incrementalRebuild')}
                  type="button"
                  variant="subtle"
                >
                  {rebuildAllMutation.isPending &&
                  rebuildAllMutation.variables === false ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Layers aria-hidden="true" className="size-4" />
                  )}
                </Button>
                <Button
                  aria-label={t('searchIndex.action.fullRebuild')}
                  className="text-amber-700 dark:text-amber-300"
                  disabled={rebuildAllMutation.isPending}
                  iconOnly
                  onClick={() => {
                    if (window.confirm(t('searchIndex.confirm.full'))) {
                      rebuildAllMutation.mutate(true)
                    }
                  }}
                  title={t('searchIndex.action.fullRebuild')}
                  type="button"
                  variant="subtle"
                >
                  {rebuildAllMutation.isPending &&
                  rebuildAllMutation.variables === true ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Hammer aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                />
                <TextInput
                  controlClassName="h-9 pl-9 focus:border-neutral-400 focus:ring-0"
                  onChange={setKeywordInput}
                  placeholder={t('searchIndex.search.placeholder')}
                  value={keywordInput}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  aria-label={t('searchIndex.filter.typeAria')}
                  onValueChange={(value) =>
                    setRefTypeFilter(value as SearchIndexRefType | '')
                  }
                  options={refTypeOptions}
                  value={refTypeFilter}
                />
                <TextInput
                  controlClassName="h-9 focus:border-neutral-400 focus:ring-0"
                  onChange={setLangFilter}
                  placeholder={t('searchIndex.filter.langPlaceholder')}
                  value={langFilter}
                />
              </div>
            </div>

            <Scroll className="flex-1">
              {documentsQuery.isLoading && rows.length === 0 ? (
                <SearchIndexSkeleton />
              ) : rows.length === 0 ? (
                <SearchIndexEmptyState />
              ) : (
                rows.map((row) => (
                  <SearchIndexRow
                    key={row.id}
                    onSelect={() => openRow(row.id)}
                    row={row}
                    selected={selectedId === row.id}
                  />
                ))
              )}
            </Scroll>

            {total > 0 ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <SelectField
                  aria-label={t('searchIndex.pagination.pageSizeAria')}
                  onValueChange={(value) => setPageSize(value)}
                  options={searchIndexPageSizeOptions.map((size) => ({
                    label: t('searchIndex.pagination.pageSize', { size }),
                    value: size,
                  }))}
                  triggerClassName="h-8 text-xs"
                  value={pageSize}
                />
                <div className="flex items-center gap-1">
                  <Button
                    aria-label={t('common.pagination.previousPage')}
                    disabled={page <= 1}
                    iconOnly
                    onClick={() => setPage(Math.max(1, page - 1))}
                    type="button"
                    variant="subtle"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </Button>
                  <span className="px-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {page} / {pageCount}
                  </span>
                  <Button
                    aria-label={t('common.pagination.nextPage')}
                    disabled={page >= pageCount}
                    iconOnly
                    onClick={() => setPage(Math.min(pageCount, page + 1))}
                    type="button"
                    variant="subtle"
                  >
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </FocusScope>
        }
      />
    </SearchIndexRouteContext.Provider>
  )
}
