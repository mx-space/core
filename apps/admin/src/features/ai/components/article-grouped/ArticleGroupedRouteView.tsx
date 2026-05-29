import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import type { ArticleInfo } from '~/api/ai'
import { useI18n } from '~/i18n'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'

import { groupedPageSize } from '../../constants'
import type { ArticleGroupedRouteContextValue } from './article-grouped-route-context'
import { ArticleGroupedRouteContext } from './article-grouped-route-context'
import { ArticleDetailEmptyState } from './ArticleDetailEmptyState'
import { ArticleListPane } from './ArticleListPane'
import type { ArticleGroupedConfig } from './types'

const SEARCH_DEBOUNCE_MS = 300

interface ArticleGroupedRouteViewProps<TItem> {
  config: ArticleGroupedConfig<TItem>
}

export function ArticleGroupedRouteView<TItem>(
  props: ArticleGroupedRouteViewProps<TItem>,
) {
  const { config } = props
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const selectedArticleId = params.id ?? null

  // Strip the trailing `/<id>` segment from the current pathname to recover
  // the list base path. Works for `/ai/summary`, `/ai/translation`, `/ai/insights`.
  const basePath = useMemo(() => {
    if (!selectedArticleId) return location.pathname
    const suffix = `/${selectedArticleId}`
    if (location.pathname.endsWith(suffix)) {
      return location.pathname.slice(0, -suffix.length)
    }
    return location.pathname
  }, [location.pathname, selectedArticleId])

  const [inputSearch, setInputSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(inputSearch.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [inputSearch])

  const listQuery = useInfiniteQuery({
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      config.getGroupedPage({
        page: pageParam,
        search: debouncedSearch || undefined,
        size: groupedPageSize,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.pagination
      if (!pagination?.hasNextPage) return undefined
      const current = pagination.currentPage ?? pagination.page ?? 1
      return current + 1
    },
    queryKey: ['ai', config.groupedQueryKey, 'grouped', debouncedSearch],
  })

  const groups = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data],
  )
  const total = listQuery.data?.pages[0]?.pagination.total ?? 0

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ai', config.groupedQueryKey],
    })
    await queryClient.invalidateQueries({ queryKey: ['ai', 'tasks'] })
  }

  const openArticle = (article: ArticleInfo) => {
    navigate(`${basePath}/${article.id}`)
  }

  const closeDetail = () => {
    navigate(basePath)
  }

  const routeContextValue = useMemo<ArticleGroupedRouteContextValue<TItem>>(
    () => ({
      basePath,
      config,
      invalidate,
      onBack: closeDetail,
    }),
    [basePath, config],
  )

  const headerActions: HeaderAction[] = [
    ...(config.pageActions?.({ invalidate }) ?? []),
    {
      kind: 'button',
      iconOnly: true,
      icon: RefreshCw,
      label: t('common.refresh'),
      onClick: () => {
        void listQuery.refetch()
      },
      disabled: listQuery.isFetching,
    },
  ]

  return (
    <AppPage>
      <PageHeader
        actions={headerActions}
        description={
          total > 0 ? t(config.totalCountKey, { count: total }) : undefined
        }
        title={t(config.pageTitleKey)}
      />

      <ArticleGroupedRouteContext.Provider
        value={
          routeContextValue as unknown as ArticleGroupedRouteContextValue<unknown>
        }
      >
        <MasterDetailShell
          emptyDetail={
            <ArticleDetailEmptyState
              description={t(config.detailEmptyDescriptionKey)}
              title={t(config.detailEmptyTitleKey)}
            />
          }
          list={
            <ArticleListPane<TItem>
              config={config}
              groups={groups}
              hasNextPage={Boolean(listQuery.hasNextPage)}
              isFetchingNextPage={listQuery.isFetchingNextPage}
              isLoading={listQuery.isLoading}
              onLoadMore={() => void listQuery.fetchNextPage()}
              onSearchChange={setInputSearch}
              onSelectArticle={openArticle}
              search={inputSearch}
              selectedArticleId={selectedArticleId}
            />
          }
        />
      </ArticleGroupedRouteContext.Provider>
    </AppPage>
  )
}
