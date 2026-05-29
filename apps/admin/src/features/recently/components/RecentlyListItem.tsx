import { ExternalLink, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { EnrichmentResult } from '~/models/enrichment'
import type { RecentlyModel } from '~/models/recently'

import { resolveEnrichment } from '~/api/enrichment'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { refTypeIcons, refTypeLabelKeys } from '../constants'
import { formatDate } from '../utils/recently'
import { EnrichmentInlineCard, VoteSummary } from './RecentlyPrimitives'

export function RecentlyListItem(props: {
  item: RecentlyModel
  onDelete: (id: string) => void
  onEdit: () => void
  onEnrichmentUpdate: (url: string, enrichment: EnrichmentResult) => void
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [retryingUrls, setRetryingUrls] = useState<Set<string>>(() => new Set())
  const totalVotes = props.item.up + props.item.down
  const upPercentage =
    totalVotes > 0 ? Math.round((props.item.up / totalVotes) * 100) : 50
  const RefIcon = props.item.refType ? refTypeIcons[props.item.refType] : null
  const refLabel = props.item.refType
    ? t(refTypeLabelKeys[props.item.refType])
    : null

  const retryEnrichment = async (url: string) => {
    setRetryingUrls((current) => new Set(current).add(url))
    try {
      const result = await resolveEnrichment(url)
      props.onEnrichmentUpdate(url, result)
      toast.success(t('recently.enrichment.refreshed'))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('recently.enrichment.refreshFailed'),
      )
    } finally {
      setRetryingUrls((current) => {
        const next = new Set(current)
        next.delete(url)
        return next
      })
    }
  }

  return (
    <article className="group px-4 py-5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
      <p className="whitespace-pre-wrap break-words text-base leading-7 text-neutral-900 dark:text-neutral-100">
        {props.item.content}
      </p>

      {props.item.enrichments &&
      Object.keys(props.item.enrichments).length > 0 ? (
        <div className="mt-3 grid gap-2">
          {Object.entries(props.item.enrichments).map(([url, enrichment]) => (
            <EnrichmentInlineCard
              enrichment={enrichment}
              key={url}
              onRetry={() => retryEnrichment(url)}
              retrying={retryingUrls.has(url)}
              url={url}
            />
          ))}
        </div>
      ) : null}

      {props.item.ref && props.item.refType && RefIcon ? (
        <a
          aria-label={t('recently.refPreview', {
            label: refLabel ?? '',
            title: props.item.ref.title,
          })}
          className="mt-3 inline-flex max-w-full items-center gap-2 rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700 no-underline transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          href={props.item.ref.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <RefIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-neutral-400"
          />
          <span className="shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {refLabel}
          </span>
          <span className="truncate">{props.item.ref.title}</span>
          <ExternalLink
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400"
          />
        </a>
      ) : null}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400">
          <time dateTime={props.item.createdAt}>
            {formatDate(props.item.createdAt)}
          </time>
          {props.item.modifiedAt ? (
            <span>
              {t('recently.editedAt', {
                time: formatDate(props.item.modifiedAt),
              })}
            </span>
          ) : null}
          <VoteSummary
            down={props.item.down}
            up={props.item.up}
            upPercentage={upPercentage}
          />
          {props.item.commentsIndex ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare aria-hidden="true" className="size-3.5" />
              {props.item.commentsIndex}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            aria-label={t('recently.row.editAria')}
            className="h-8 px-2"
            onClick={props.onEdit}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">{t('recently.row.edit')}</span>
          </Button>
          <Button
            aria-label={t('recently.row.deleteAria')}
            className="h-8 px-2 text-red-600 dark:text-red-400"
            onClick={() => {
              if (isConfirmingDelete) {
                props.onDelete(props.item.id)
                setIsConfirmingDelete(false)
              } else {
                setIsConfirmingDelete(true)
              }
            }}
            onMouseLeave={() => setIsConfirmingDelete(false)}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">
              {isConfirmingDelete
                ? t('recently.row.confirm')
                : t('recently.row.delete')}
            </span>
          </Button>
        </div>
      </footer>
    </article>
  )
}
