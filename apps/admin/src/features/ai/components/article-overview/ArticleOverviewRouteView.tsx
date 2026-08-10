import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import type { OverviewArticleType } from '~/api/ai-overview'
import { getOverviewGrouped } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { AppPage, HeaderActions } from '~/ui/layout/page-layout'
import { Scroll } from '~/ui/primitives/scroll'
import { SegmentedControl } from '~/ui/primitives/segmented-control'

import { groupedPageSize } from '../../constants'
import { ArticleDetailEmptyState } from '../article-grouped/ArticleDetailEmptyState'
import { BorderlessSearchInput } from '../article-grouped/BorderlessSearchInput'
import { OverviewListRow } from './OverviewListRow'

const SEARCH_DEBOUNCE_MS = 300

export function ArticleOverviewRouteView() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const selectedArticleId = params.id ?? null

  const basePath = useMemo(() => {
    if (!selectedArticleId) return location.pathname
    const suffix = `/${selectedArticleId}`
    return location.pathname.endsWith(suffix)
      ? location.pathname.slice(0, -suffix.length)
      : location.pathname
  }, [location.pathname, selectedArticleId])

  const [inputSearch, setInputSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<OverviewArticleType | 'all'>(
    'all',
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(inputSearch.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [inputSearch])

  const listQuery = useInfiniteQuery({
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getOverviewGrouped({
        page: pageParam,
        search: debouncedSearch || undefined,
        size: groupedPageSize,
        type: typeFilter === 'all' ? undefined : typeFilter,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.pagination
      if (!pagination?.hasNextPage) return undefined
      return (pagination.currentPage ?? pagination.page ?? 1) + 1
    },
    queryKey: adminQueryKeys.ai.overviewList({
      search: debouncedSearch,
      type: typeFilter,
    }),
  })

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data],
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !listQuery.hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          !listQuery.isFetchingNextPage
        ) {
          void listQuery.fetchNextPage()
        }
      },
      { root: scrollRef.current, rootMargin: '240px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    listQuery.hasNextPage,
    listQuery.isFetchingNextPage,
    listQuery.fetchNextPage,
  ])

  const empty = !listQuery.isLoading && rows.length === 0
  const hasSearch = inputSearch.trim().length > 0

  return (
    <AppPage>
      <MasterDetailShell
        emptyDetail={
          <ArticleDetailEmptyState
            description={t('ai.overview.detailEmptyDescription')}
            title={t('ai.overview.detailEmptyTitle')}
          />
        }
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id="ai-overview-articles"
          >
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border pl-1 pr-2">
              <MobileHeaderAffordance />
              <BorderlessSearchInput
                ariaLabel={t('ai.overview.searchPlaceholder')}
                onChange={setInputSearch}
                placeholder={t('ai.overview.searchPlaceholder')}
                value={inputSearch}
              />
              <HeaderActions
                actions={[
                  {
                    kind: 'button',
                    iconOnly: true,
                    icon: RefreshCw,
                    label: t('common.refresh'),
                    onClick: () => {
                      void queryClient.invalidateQueries({
                        queryKey: adminQueryKeys.ai.overviewRoot,
                      })
                    },
                    disabled: listQuery.isFetching,
                  },
                ]}
              />
            </div>

            <div className="shrink-0 border-b border-border px-2 py-2">
              <SegmentedControl
                aria-label={t('ai.overview.typeFilterLabel')}
                fill
                onValueChange={setTypeFilter}
                options={[
                  { label: t('ai.overview.type.all'), value: 'all' },
                  { label: t('ai.overview.type.post'), value: 'post' },
                  { label: t('ai.overview.type.note'), value: 'note' },
                  { label: t('ai.overview.type.page'), value: 'page' },
                ]}
                value={typeFilter}
              />
            </div>

            <Scroll className="flex-1" ref={scrollRef}>
              {empty ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
                  <Inbox aria-hidden="true" className="size-8 text-fg-subtle" />
                  <p className="text-sm font-medium text-fg">
                    {hasSearch
                      ? t('ai.articleGrouped.searchEmptyTitle')
                      : t('ai.overview.listEmptyTitle')}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {hasSearch
                      ? t('ai.articleGrouped.searchEmptyHint')
                      : t('ai.overview.listEmptyDescription')}
                  </p>
                </div>
              ) : (
                <>
                  {rows.map((row) => (
                    <OverviewListRow
                      key={`${row.article.type}-${row.article.id}`}
                      onSelect={() => navigate(`${basePath}/${row.article.id}`)}
                      row={row}
                      selected={selectedArticleId === row.article.id}
                    />
                  ))}
                  {listQuery.hasNextPage ? (
                    <div
                      className="flex items-center justify-center py-3"
                      ref={sentinelRef}
                    >
                      {listQuery.isFetchingNextPage ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin text-fg-subtle"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </Scroll>
          </FocusScope>
        }
      />
    </AppPage>
  )
}
