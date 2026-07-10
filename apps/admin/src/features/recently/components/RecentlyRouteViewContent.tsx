import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, StickyNote } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { getRecentlyList } from '~/api/recently'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import {
  useCollectionInfiniteQuery,
  useEntityList,
} from '~/data/resource/hooks'
import { recentlies } from '~/data/resources/recently'
import {
  applyRecentlyEnrichment,
  removeRecently,
} from '~/data/resources/recently.mutations'
import { useI18n } from '~/i18n'
import type { EnrichmentResult } from '~/models/enrichment'
import type { RecentlyModel } from '~/models/recently'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  RECENTLY_PAGE_SIZE,
  recentlyListQueryKey,
  recentlyQueryKey,
} from '../constants'
import { presentRecentlyEditor } from './RecentlyEditorModal'
import { RecentlyListItem } from './RecentlyListItem'
import {
  RecentlyEmptyState,
  RecentlyErrorState,
  RecentlyListSkeleton,
  RecentlyLoadMore,
} from './RecentlyStates'

export function RecentlyRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const recentlyQuery = useCollectionInfiniteQuery<
    RecentlyModel,
    RecentlyModel[],
    null | string
  >(recentlies, {
    getNextPageParam: (lastResult) =>
      lastResult.length >= RECENTLY_PAGE_SIZE
        ? (lastResult.at(-1)?.id ?? undefined)
        : undefined,
    initialPageParam: null as null | string,
    queryFn: (pageParam) =>
      getRecentlyList({
        before: pageParam ?? undefined,
        size: RECENTLY_PAGE_SIZE,
      }),
    queryKey: recentlyListQueryKey,
    toItems: (result) => result,
  })
  const recentlyList = useEntityList(recentlies, recentlyListQueryKey)

  const deleteMutation = useMutation({
    mutationFn: removeRecently,
    onSuccess: async () => {
      toast.success(t('recently.deleteSuccess'))
      await queryClient.invalidateQueries({ queryKey: recentlyQueryKey })
    },
  })

  const openEditor = async (item: RecentlyModel | null) => {
    const ok = await presentRecentlyEditor(item)
    if (ok) {
      await queryClient.invalidateQueries({ queryKey: recentlyQueryKey })
    }
  }

  useEffect(() => {
    if (searchParams.get('create') !== '1') return

    void openEditor(null)

    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const updateItemEnrichment = (
    itemId: string,
    url: string,
    enrichment: EnrichmentResult,
  ) => {
    applyRecentlyEnrichment(itemId, url, enrichment)
  }

  const items = recentlyList.items
  const hasNextPage = Boolean(recentlyQuery.hasNextPage)

  useEffect(() => {
    const target = loadMoreRef.current
    const root = scrollContainerRef.current

    if (!target || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          !recentlyQuery.isFetchingNextPage
        ) {
          void recentlyQuery.fetchNextPage()
        }
      },
      { root, rootMargin: '240px' },
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [
    hasNextPage,
    recentlyQuery.fetchNextPage,
    recentlyQuery.isFetchingNextPage,
  ])

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            <StickyNote aria-hidden="true" className="size-4" />
            {t('recently.title')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {recentlyQuery.isLoading
              ? t('recently.count.loading')
              : hasNextPage
                ? t('recently.count.partial', { count: items.length })
                : t('recently.count.total', { count: items.length })}
          </span>
          <Button
            onClick={() => void openEditor(null)}
            type="button"
            variant="subtle"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('recently.create')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1" ref={scrollContainerRef}>
        {recentlyQuery.isLoading && items.length === 0 ? (
          <RecentlyListSkeleton />
        ) : recentlyQuery.isError && items.length === 0 ? (
          <RecentlyErrorState onRetry={() => recentlyQuery.refetch()} />
        ) : items.length === 0 ? (
          <RecentlyEmptyState onCreate={() => void openEditor(null)} />
        ) : (
          <div
            aria-label={t('recently.feedAria')}
            className="mx-auto max-w-4xl divide-y divide-neutral-200 dark:divide-neutral-800"
            role="feed"
          >
            {items.map((item) => (
              <RecentlyListItem
                item={item}
                key={item.id}
                onDelete={(id) => deleteMutation.mutate(id)}
                onEdit={() => void openEditor(item)}
                onEnrichmentUpdate={(url, enrichment) =>
                  updateItemEnrichment(item.id, url, enrichment)
                }
              />
            ))}
            <RecentlyLoadMore
              hasNextPage={hasNextPage}
              isFetching={recentlyQuery.isFetchingNextPage}
              onLoadMore={() => recentlyQuery.fetchNextPage()}
              ref={loadMoreRef}
            />
          </div>
        )}
      </Scroll>
    </section>
  )
}
