import { Edit3, ExternalLink, Loader2, X } from 'lucide-react'
import { Link } from 'react-router'

import { WEB_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import type { NoteModel } from '~/models/note'
import { relativeTimeFromNow } from '~/utils/time'

export function TopicNoteRow(props: {
  note: Partial<NoteModel>
  onRemove: () => void
  removing: boolean
}) {
  const { t } = useI18n()
  const title = props.note.title || t('topics.notes.unnamed')
  const externalHref =
    typeof props.note.nid === 'number'
      ? `${WEB_URL}/notes/${props.note.nid}`
      : '#'

  return (
    <div className="group flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {typeof props.note.nid === 'number' ? (
            <span className="shrink-0 font-mono text-xs text-fg-subtle">
              #{props.note.nid}
            </span>
          ) : null}
          <p className="truncate text-sm font-medium text-fg">{title}</p>
          {props.note.createdAt ? (
            <time
              className="shrink-0 text-xs text-fg-subtle"
              dateTime={props.note.createdAt}
            >
              {relativeTimeFromNow(props.note.createdAt)}
            </time>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          className="inline-flex size-8 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          href={externalHref}
          rel="noreferrer"
          target="_blank"
          title={t('topics.notes.openExternal')}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        {props.note.id ? (
          <Link
            className="inline-flex size-8 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            to={`/notes?keyword=${encodeURIComponent(title)}`}
            title={t('topics.notes.findInList')}
          >
            <Edit3 aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        <button
          className="inline-flex size-8 items-center justify-center rounded border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={props.removing || !props.note.id}
          onClick={props.onRemove}
          title={t('topics.notes.removeFromTopic')}
          type="button"
        >
          {props.removing ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <X aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    </div>
  )
}
