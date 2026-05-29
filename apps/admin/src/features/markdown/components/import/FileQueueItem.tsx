import { AlertTriangle, X } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'
import { cn } from '~/utils/cn'

export type FileQueueStatus = 'edited' | 'failed' | 'ok'

interface FileQueueItemProps {
  edited: boolean
  failed: boolean
  filename: string
  onRemove: (filename: string) => void
  onSelect: (filename: string) => void
  selected: boolean
}

export function FileQueueItem(props: FileQueueItemProps) {
  const { t } = useI18n()
  const dotClass = props.failed
    ? 'bg-red-500'
    : props.edited
      ? 'bg-blue-500'
      : 'bg-emerald-500'

  return (
    <div
      aria-selected={props.selected}
      className={cn(
        'group flex h-12 cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 transition-colors last:border-b-0 dark:border-neutral-800/60',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-800'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60',
      )}
      onClick={() => props.onSelect(props.filename)}
      role="option"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onSelect(props.filename)
        }
      }}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', dotClass)}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
        {props.filename}
      </span>
      {props.failed ? (
        <Badge size="sm" tone="danger">
          <AlertTriangle aria-hidden="true" className="size-3" />
          {t('markdown.import.failPane.title')}
        </Badge>
      ) : props.edited ? (
        <Badge size="sm" tone="info">
          {t('markdown.import.editedBadge')}
        </Badge>
      ) : null}
      <button
        aria-label={t('markdown.import.removeAria', {
          filename: props.filename,
        })}
        className="hidden h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:flex dark:hover:bg-red-950/30 dark:hover:text-red-400"
        onClick={(event) => {
          event.stopPropagation()
          props.onRemove(props.filename)
        }}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
