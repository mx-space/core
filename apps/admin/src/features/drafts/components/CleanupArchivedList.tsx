import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { CleanupDraftCandidate } from '~/models/draft'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

export function CleanupArchivedList(props: {
  items: CleanupDraftCandidate[]
  onChange: (next: Set<string>) => void
  selected: Set<string>
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  if (!props.items.length) return null
  const toggle = (id: string, on: boolean) => {
    const next = new Set(props.selected)
    if (on) next.add(id)
    else next.delete(id)
    props.onChange(next)
  }

  return (
    <section className="border-b border-border">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-3.5 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-fg">
            {t('drafts.cleanup.archived.title')}
          </span>
          <span className="text-xs text-fg-muted">
            {t('drafts.cleanup.archived.description', {
              count: props.items.length,
            })}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 text-fg-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul className="flex flex-col pb-2">
          {props.items.map((item) => (
            <li key={item.draftId}>
              <label className="flex items-center gap-3 px-6 py-1.5 pl-12 text-sm text-fg">
                <Checkbox
                  checked={props.selected.has(item.draftId)}
                  onCheckedChange={(checked) => toggle(item.draftId, checked)}
                />
                <span className="min-w-0 flex-1 truncate">
                  {item.title || t('drafts.row.untitled')}
                </span>
                <span className="text-xs tabular-nums text-fg-muted">
                  {formatBytes(item.bytes)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
