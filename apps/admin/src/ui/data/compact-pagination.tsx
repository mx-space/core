import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useI18n } from '~/i18n'
import { SelectField } from '~/ui/primitives/select'

export interface CompactPaginationProps {
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  page: number
  pageCount: number
  pageSize: number
  pageSizes?: number[]
}

export function CompactPagination(props: CompactPaginationProps) {
  const { t } = useI18n()
  const pageSizes = props.pageSizes ?? [10, 20, 50, 100]
  const canPrev = props.page > 1
  const canNext = props.page < props.pageCount

  return (
    <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
      <button
        aria-label={t('common.pagination.previousPage')}
        className="flex size-6 items-center justify-center rounded transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
        disabled={!canPrev}
        onClick={() => {
          if (canPrev) props.onPageChange(props.page - 1)
        }}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-3.5" />
      </button>

      <span className="px-1 tabular-nums">
        <span className="text-neutral-900 dark:text-neutral-100">
          {props.page}
        </span>
        <span className="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
        <span>{props.pageCount}</span>
      </span>

      <button
        aria-label={t('common.pagination.nextPage')}
        className="flex size-6 items-center justify-center rounded transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
        disabled={!canNext}
        onClick={() => {
          if (canNext) props.onPageChange(props.page + 1)
        }}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </button>

      <SelectField
        aria-label={t('common.pagination.pageSize', { count: props.pageSize })}
        onValueChange={props.onPageSizeChange}
        options={pageSizes.map((size) => ({
          label: t('common.pagination.pageSize', { count: size }),
          value: size,
        }))}
        popupClassName="text-xs"
        triggerClassName="ml-1 h-auto w-auto border-0 bg-transparent px-1.5 py-0.5 text-xs tabular-nums hover:bg-neutral-100 dark:bg-transparent dark:hover:bg-neutral-800"
        value={props.pageSize}
      />
    </div>
  )
}
