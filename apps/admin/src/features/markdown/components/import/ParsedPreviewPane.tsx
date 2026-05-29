import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import type { ParsedItem } from '../../types/markdown'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { DateTimePicker } from '~/ui/primitives/datetime-picker'
import { MarkdownRender } from '~/ui/primitives/markdown-render'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

type MetaEdits = Partial<NonNullable<ParsedItem['meta']>>

interface ParsedPreviewPaneProps {
  edits: MetaEdits | undefined
  failed: boolean
  failureReason?: string
  invalid: boolean
  item: ParsedItem
  onEdit: (filename: string, partial: MetaEdits) => void
  onRemove: (filename: string) => void
  onResetEdits: (filename: string) => void
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toDatetimeLocal(value: string | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const offset = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return offset.toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function ParsedPreviewPane(props: ParsedPreviewPaneProps) {
  const { t } = useI18n()
  const meta = props.item.meta ?? {}
  const edits = props.edits ?? {}
  const title = edits.title ?? meta.title ?? ''
  const slug = edits.slug ?? meta.slug ?? ''
  const date = edits.date ?? meta.date ?? ''
  const charCount = props.item.text.length

  if (props.failed) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center border-b border-neutral-200 px-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-200">
          <span className="truncate font-medium">{props.item.filename}</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle aria-hidden="true" className="size-6" />
          </div>
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            {t('markdown.import.failPane.title')}
          </h3>
          {props.failureReason ? (
            <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">
              {props.failureReason}
            </p>
          ) : null}
          <Button
            className="mt-2"
            onClick={() => props.onRemove(props.item.filename)}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t('markdown.import.removeRow')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {props.item.filename}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-neutral-400">
            {charCount.toLocaleString()}
          </span>
        </div>
        {props.edits ? (
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            onClick={() => props.onResetEdits(props.item.filename)}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('markdown.import.resetEdits')}
          </button>
        ) : null}
      </div>

      <Scroll className="flex-1">
        <div className="space-y-5 p-4">
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <label
                className={cn(
                  'text-xs font-medium',
                  props.invalid && !title.trim()
                    ? 'text-red-500'
                    : 'text-neutral-500',
                )}
                htmlFor={`md-title-${props.item.filename}`}
              >
                title{' '}
                {props.invalid && !title.trim() ? (
                  <span className="text-red-500"> *</span>
                ) : null}
              </label>
              <TextInput
                controlClassName={cn(
                  props.invalid && !title.trim() && 'border-red-500',
                )}
                id={`md-title-${props.item.filename}`}
                onChange={(value) =>
                  props.onEdit(props.item.filename, { title: value })
                }
                placeholder={meta.title ?? props.item.filename}
                value={title}
              />
            </div>

            <div className="grid gap-1.5">
              <label
                className={cn(
                  'text-xs font-medium',
                  props.invalid && !slug.trim()
                    ? 'text-red-500'
                    : 'text-neutral-500',
                )}
                htmlFor={`md-slug-${props.item.filename}`}
              >
                slug
              </label>
              <div className="flex items-center gap-2">
                <TextInput
                  className="flex-1"
                  controlClassName={cn(
                    'font-mono',
                    props.invalid && !slug.trim() && 'border-red-500',
                  )}
                  id={`md-slug-${props.item.filename}`}
                  onChange={(value) =>
                    props.onEdit(props.item.filename, { slug: value })
                  }
                  placeholder={
                    meta.slug ?? slugify(title || (meta.title ?? ''))
                  }
                  value={slug}
                />
                <button
                  aria-label={t('markdown.import.regenSlug')}
                  className="inline-flex h-9 items-center gap-1 rounded border border-neutral-200 bg-white px-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                  disabled={!title.trim()}
                  onClick={() =>
                    props.onEdit(props.item.filename, {
                      slug: slugify(title || (meta.title ?? '')),
                    })
                  }
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label
                className="text-xs font-medium text-neutral-500"
                htmlFor={`md-date-${props.item.filename}`}
              >
                date
              </label>
              <DateTimePicker
                id={`md-date-${props.item.filename}`}
                onChange={(value) =>
                  props.onEdit(props.item.filename, {
                    date: fromDatetimeLocal(value),
                  })
                }
                value={toDatetimeLocal(date)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t('markdown.import.preview')}
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <MarkdownRender text={props.item.text} />
            </div>
          </div>
        </div>
      </Scroll>
    </div>
  )
}
