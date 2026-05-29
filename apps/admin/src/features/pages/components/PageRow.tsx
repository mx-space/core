import {
  ExternalLink,
  FileText,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { DragEvent } from 'react'
import { Link } from 'react-router'
import type { PageModel } from '~/models/page'

import { WEB_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { ButtonLink } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

export function PageRow(props: {
  deleting: boolean
  dragging: boolean
  index: number
  onDelete: (id: string) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  page: PageModel
  reordering: boolean
}) {
  const { t } = useI18n()
  const page = props.page
  const title = page.title || t('pages.row.untitled')

  return (
    <article
      className={cn(
        'grid gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center dark:hover:bg-neutral-900/50',
        props.dragging && 'bg-neutral-100 opacity-60 dark:bg-neutral-900',
      )}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <div className="flex min-w-0 items-start gap-3">
        <button
          aria-label={t('pages.list.dragLabel', { title })}
          className="mt-0.5 inline-flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-400"
          disabled={props.reordering}
          draggable={!props.reordering}
          onDragEnd={props.onDragEnd}
          onDragStart={props.onDragStart}
          type="button"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FileText aria-hidden="true" className="size-4 text-neutral-400" />
            <Link
              className="outline-hidden truncate text-sm font-medium text-neutral-950 transition-colors hover:text-neutral-600 focus-visible:underline dark:text-neutral-50 dark:hover:text-neutral-300"
              to={`/pages/edit?id=${encodeURIComponent(page.id)}`}
            >
              {title}
            </Link>
            {typeof page.order === 'number' ? (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                #{page.order}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{t('pages.row.orderIndex', { index: props.index + 1 })}</span>
            <span>/{page.slug}</span>
            {page.subtitle ? <span>{page.subtitle}</span> : null}
            <time dateTime={page.createdAt}>
              {relativeTimeFromNow(page.createdAt)}
            </time>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ButtonLink
          className="size-9 px-0"
          title={t('pages.action.editPage')}
          to={`/pages/edit?id=${encodeURIComponent(page.id)}`}
          variant="subtle"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </ButtonLink>
        <a
          className="inline-flex size-9 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          href={`${WEB_URL}/${page.slug}`}
          rel="noreferrer"
          target="_blank"
          title={t('pages.action.openPage')}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <button
          className="inline-flex size-9 items-center justify-center rounded border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={props.deleting}
          onClick={() => props.onDelete(page.id)}
          title={t('pages.action.deletePage')}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  )
}
