import { RefreshCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { EnrichmentResult } from '~/models/enrichment'

import { useI18n } from '~/i18n'

import { hostnameOf } from '../utils/recently'

export function EnrichmentInlineCard(props: {
  enrichment: EnrichmentResult
  onRetry?: () => void
  retrying?: boolean
  url: string
}) {
  const { t } = useI18n()
  const image =
    props.enrichment.thumbnailImage?.url || props.enrichment.previewImage?.url

  return (
    <div className="flex gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800">
      <a
        className="flex min-w-0 flex-1 gap-3 text-inherit no-underline"
        href={props.enrichment.url || props.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {image ? (
          <img
            alt=""
            className="size-14 shrink-0 rounded object-cover"
            src={image}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
            {props.enrichment.title}
          </div>
          {props.enrichment.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {props.enrichment.description}
            </p>
          ) : null}
          <div className="mt-1 truncate text-xs text-neutral-400">
            {hostnameOf(props.enrichment.url || props.url)}
          </div>
        </div>
      </a>
      {props.onRetry ? (
        <button
          aria-label={t('recently.enrichment.refreshAria')}
          className="flex size-8 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-60 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          disabled={props.retrying}
          onClick={props.onRetry}
          type="button"
        >
          <RefreshCcw
            aria-hidden="true"
            className={`size-4 ${props.retrying ? 'animate-spin' : ''}`}
          />
        </button>
      ) : null}
    </div>
  )
}

export function VoteSummary(props: {
  down: number
  up: number
  upPercentage: number
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1">
        <ThumbsUp aria-hidden="true" className="size-3.5" />
        {props.up}
      </span>
      <span className="h-3 w-px bg-neutral-200 dark:bg-neutral-700" />
      <span className="inline-flex items-center gap-1">
        <ThumbsDown aria-hidden="true" className="size-3.5" />
        {props.down}
      </span>
      {props.up + props.down > 0 ? (
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <span
            className="block h-full rounded-full bg-green-500"
            style={{ width: `${props.upPercentage}%` }}
          />
        </span>
      ) : null}
    </span>
  )
}
