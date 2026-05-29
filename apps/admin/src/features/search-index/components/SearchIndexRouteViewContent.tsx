import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Hammer,
  Layers,
  Loader2,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import type {
  SearchDocumentAdminRow,
  SearchIndexRefType,
} from '~/api/search-index'
import {
  getSearchIndexDocuments,
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

import { refTypeOptionKeys, searchIndexQueryKey } from '../constants'
import { getErrorMessage } from '../utils/format'
import { SearchIndexRouteContext } from './search-index-route-context'
import { SearchIndexDetailEmptyState } from './SearchIndexDetailEmptyState'
import { SearchIndexEmptyState } from './SearchIndexEmptyState'
import { SearchIndexRow } from './SearchIndexRow'
import { SearchIndexSkeleton } from './SearchIndexSkeleton'

const FOCUS_SCOPE_ID = 'search-index'
const KEYWORD_DEBOUNCE_MS = 350
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const REF_TYPE_VALUES = new Set<string>(['note', 'page', 'post'])

export function SearchIndexRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const selectedId = params.id ?? null
  const [searchParams, setSearchParams] = useSearchParams()

  const refTypeFilter = parseRefType(searchParams.get('type'))
  const langFilter = searchParams.get('lang') ?? ''
  const keyword = searchParams.get('q') ?? ''
  const page = clampPositive(searchParams.get('page'), 1)
  const pageSize = clampPageSize(searchParams.get('size'))

  const [keywordInput, setKeywordInput] = useState(keyword)

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    const trimmed = keywordInput.trim()
    if (trimmed === keyword) return
    const timer = window.setTimeout(() => {
      updateParams((params) => {
        if (trimmed) params.set('q', trimmed)
        else params.delete('q')
        params.delete('page')
      })
    }, KEYWORD_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [keywordInput, keyword, updateParams])

  const closeDetail = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/maintenance/search-index${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const openRow = useCallback(
    (id: string) => {
      const qs = searchParams.toString()
      navigate(
        `/maintenance/search-index/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
      )
    },
    [navigate, searchParams],
  )

  const setRefTypeFilter = (value: SearchIndexRefType | '') => {
    updateParams((params) => {
      if (value) params.set('type', value)
      else params.delete('type')
      params.delete('page')
    })
  }
  const setLangFilter = (value: string) => {
    const trimmed = value.trim()
    updateParams((params) => {
      if (trimmed) params.set('lang', trimmed)
      else params.delete('lang')
      params.delete('page')
    })
  }
  const setPage = (value: number) => {
    updateParams((params) => {
      if (value <= 1) params.delete('page')
      else params.set('page', String(value))
    })
  }
  const setPageSize = (value: number) => {
    updateParams((params) => {
      if (value === PAGE_SIZE_OPTIONS[0]) params.delete('size')
      else params.set('size', String(value))
      params.delete('page')
    })
  }

  const refTypeOptions = refTypeOptionKeys.map((opt) => ({
    label: t(opt.labelKey),
    value: opt.value,
  }))

  const queryParams = {
    keyword: keyword || undefined,
    lang: langFilter || undefined,
    page,
    refType: refTypeFilter || undefined,
    size: pageSize,
  }

  const documentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSearchIndexDocuments(queryParams),
    queryKey: [...searchIndexQueryKey, queryParams],
  })

  const rows = useMemo(
    () => documentsQuery.data?.data ?? [],
    [documentsQuery.data],
  )
  const total = documentsQuery.data?.pagination.total ?? 0
  const pageCount = documentsQuery.data?.pagination.totalPage ?? 1

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
                  options={PAGE_SIZE_OPTIONS.map((size) => ({
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

function parseRefType(raw: string | null): SearchIndexRefType | '' {
  if (raw && REF_TYPE_VALUES.has(raw)) return raw as SearchIndexRefType
  return ''
}

function clampPositive(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function clampPageSize(raw: string | null): number {
  const parsed = clampPositive(raw, PAGE_SIZE_OPTIONS[0])
  if (
    PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
  ) {
    return parsed
  }
  return PAGE_SIZE_OPTIONS[0]
}
