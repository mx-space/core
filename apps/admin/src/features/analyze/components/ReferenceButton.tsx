import { BookOpen, ExternalLink } from 'lucide-react'

import { getReferenceUrl } from '~/api/activity'
import { cn } from '~/utils/cn'

export function ReferenceButton(props: { id?: string; title: string }) {
  const openReference = async () => {
    if (!props.id) return
    const url = await getReferenceUrl(props.id)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate text-left text-sm text-neutral-800 dark:text-neutral-100',
        props.id
          ? 'hover:text-[var(--color-primary)]'
          : 'cursor-default text-neutral-400 dark:text-neutral-500',
      )}
      disabled={!props.id}
      onClick={() => {
        void openReference()
      }}
      type="button"
    >
      <BookOpen
        aria-hidden="true"
        className="size-3.5 shrink-0 text-neutral-400"
      />
      <span className="truncate">{props.title}</span>
      {props.id ? (
        <ExternalLink
          aria-hidden="true"
          className="size-3 shrink-0 text-neutral-400"
        />
      ) : null}
    </button>
  )
}
