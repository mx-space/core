import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getPages } from '~/api/pages'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { pages } from '~/data/resources/page'
import {
  removePage,
  reorderPagesOptimistic,
} from '~/data/resources/page.mutations'
import { useI18n } from '~/i18n'
import type { PageModel } from '~/models/page'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button, ButtonLink } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { pagesQueryKey } from '../constants'
import { getErrorMessage } from '../utils/errors'
import { reorderList } from '../utils/reorder-list'
import { PageRow } from './PageRow'
import { PagesEmpty } from './PagesEmpty'
import { PagesError } from './PagesError'
import { PagesSkeleton } from './PagesSkeleton'

const pagesListQueryKey = adminQueryKeys.pages.list({ page: 1, size: 100 })

export function PagesRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [draggingId, setDraggingId] = useState('')

  const pagesQuery = useCollectionListQuery(pages, {
    queryFn: () => getPages({ page: 1, size: 100 }),
    queryKey: pagesListQueryKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const pagesList = useEntityList(pages, pagesListQueryKey)
  const orderedPages = useMemo(
    () => [...pagesList.items].sort((a, b) => (b.order ?? 0) - (a.order ?? 0)),
    [pagesList.items],
  )

  const deleteMutation = useMutation({
    mutationFn: removePage,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('pages.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('pages.toast.deleted'))
      await queryClient.invalidateQueries({ queryKey: pagesQueryKey })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: reorderPagesOptimistic,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('pages.toast.reorderFailed'))),
    onSuccess: async () => {
      toast.success(t('pages.toast.reorderSaved'))
      await queryClient.invalidateQueries({ queryKey: pagesQueryKey })
    },
  })

  const commitReorder = (nextPages: PageModel[]) => {
    const seq = [...nextPages]
      .reverse()
      .map((page, index) => ({ id: page.id, order: index + 1 }))
    reorderMutation.mutate(seq)
  }

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await confirmDialog({
      destructive: true,
      title: t('pages.confirmDelete', {
        title: title || t('pages.row.untitled'),
      }),
    })
    if (!confirmed) return
    deleteMutation.mutate(id)
  }

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
            <FileText aria-hidden="true" className="size-4" />
            {t('pages.title')}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
            {t('pages.header.count', {
              count: pagesList.pagination?.total ?? 0,
            })}
          </span>
          <ButtonLink aria-label={t('pages.action.newPage')} to="/pages/edit">
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">
              {t('pages.action.newPage')}
            </span>
          </ButtonLink>
          <Button
            aria-label={t('pages.list.refreshAria')}
            disabled={pagesQuery.isFetching}
            onClick={() => void pagesQuery.refetch()}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-4', pagesQuery.isFetching && 'animate-spin')}
            />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </Button>
        </div>
      </div>

      <Scroll className="min-h-0 flex-1">
        {pagesQuery.isLoading && orderedPages.length === 0 ? (
          <PagesSkeleton />
        ) : pagesQuery.isError ? (
          <PagesError onRetry={() => void pagesQuery.refetch()} />
        ) : orderedPages.length === 0 ? (
          <PagesEmpty />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {orderedPages.map((page, index) => (
              <PageRow
                deleting={deleteMutation.isPending}
                dragging={draggingId === page.id}
                index={index}
                key={page.id}
                onDelete={(id) => {
                  void handleDelete(id, page.title)
                }}
                onDragEnd={() => setDraggingId('')}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  setDraggingId(page.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', page.id)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const sourceId =
                    event.dataTransfer.getData('text/plain') || draggingId
                  if (!sourceId || sourceId === page.id) return
                  const sourceIndex = orderedPages.findIndex(
                    (item) => item.id === sourceId,
                  )
                  if (sourceIndex < 0) return
                  commitReorder(reorderList(orderedPages, sourceIndex, index))
                }}
                page={page}
                reordering={reorderMutation.isPending}
              />
            ))}
          </div>
        )}
      </Scroll>

      <div className="flex h-11 shrink-0 items-center justify-between border-t border-neutral-200 px-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <span>{t('pages.footer.count', { count: orderedPages.length })}</span>
        {reorderMutation.isPending ? (
          <span>{t('pages.footer.reorderSaving')}</span>
        ) : null}
      </div>
    </section>
  )
}
