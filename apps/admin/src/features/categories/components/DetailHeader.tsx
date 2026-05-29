import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { cn } from '~/utils/cn'

export function DetailHeader(props: {
  children?: ReactNode
  onBack: () => void
  title: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
          onClick={props.onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </button>
        <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          {props.title}
        </h2>
      </div>
      {props.children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {props.children}
        </div>
      ) : null}
    </div>
  )
}
