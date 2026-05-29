import { Loader2, RefreshCcw, StickyNote } from 'lucide-react'
import { forwardRef } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function RecentlyEmptyState(props: { onCreate: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-900">
        <StickyNote aria-hidden="true" className="size-8 text-neutral-400" />
      </div>
      <h2 className="mb-1 text-lg font-medium text-neutral-900 dark:text-neutral-100">
        {t('recently.empty.title')}
      </h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        {t('recently.empty.description')}
      </p>
      <Button onClick={props.onCreate} type="button">
        {t('recently.empty.cta')}
      </Button>
    </div>
  )
}

export function RecentlyErrorState(props: { onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {t('recently.error.title')}
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {t('recently.error.description')}
      </p>
      <Button
        className="mt-4"
        onClick={props.onRetry}
        type="button"
        variant="subtle"
      >
        <RefreshCcw aria-hidden="true" className="size-4" />
        {t('recently.error.retry')}
      </Button>
    </div>
  )
}

export const RecentlyLoadMore = forwardRef<
  HTMLDivElement,
  {
    hasNextPage: boolean
    isFetching: boolean
    onLoadMore: () => void
  }
>(function RecentlyLoadMore(props, ref) {
  const { t } = useI18n()
  return (
    <div
      className="flex items-center justify-center px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400"
      ref={ref}
    >
      {props.hasNextPage ? (
        <Button
          disabled={props.isFetching}
          onClick={props.onLoadMore}
          type="button"
          variant="subtle"
        >
          {props.isFetching ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('recently.loadMore')}
        </Button>
      ) : (
        <span>{t('recently.allLoaded')}</span>
      )}
    </div>
  )
})

export function RecentlyListSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      {[1, 2, 3].map((index) => (
        <div
          className="border-b border-neutral-200 px-4 py-5 last:border-b-0 dark:border-neutral-800"
          key={index}
        >
          <div className="h-5 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-2 h-5 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="mt-4 flex gap-4">
            <div className="h-4 w-28 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-4 w-20 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      ))}
    </div>
  )
}
