import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface CollapsibleSectionProps {
  defaultOpen?: boolean
  hint?: ReactNode
  title: ReactNode
  children: ReactNode
}

export function CollapsibleSection(props: CollapsibleSectionProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false)

  return (
    <section className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="flex-1">{props.title}</span>
        {props.hint ? (
          <span className="text-xs font-normal normal-case text-neutral-400 dark:text-neutral-500">
            {props.hint}
          </span>
        ) : null}
      </button>
      {open ? <div className="mt-3">{props.children}</div> : null}
    </section>
  )
}
