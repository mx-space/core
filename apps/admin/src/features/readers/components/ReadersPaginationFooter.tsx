import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pager } from '~/models/base'

import { cn } from '~/utils/cn'

interface ReadersPaginationFooterProps {
  pagination: Pager
  page: number
  onPageChange: (page: number) => void
}

const navButtonClass =
  'inline-flex size-7 items-center justify-center rounded text-neutral-600 transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800'

export function ReadersPaginationFooter(props: ReadersPaginationFooterProps) {
  const { page, pagination } = props
  const totalPages = Math.max(1, pagination.totalPages)
  if (totalPages <= 1) return null

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
      <button
        aria-label="Previous page"
        className={navButtonClass}
        disabled={page <= 1}
        onClick={() => props.onPageChange(page - 1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <span
        className={cn(
          'text-xs tabular-nums text-neutral-500 dark:text-neutral-400',
        )}
      >
        {page} / {totalPages}
      </span>
      <button
        aria-label="Next page"
        className={navButtonClass}
        disabled={page >= totalPages}
        onClick={() => props.onPageChange(page + 1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
