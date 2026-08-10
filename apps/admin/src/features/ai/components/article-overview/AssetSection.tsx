import { ExternalLink, RotateCw, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import type { AiOverviewCapability } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { cn } from '~/utils/cn'

import type { AssetRow } from './asset-rows'
import { CAPABILITY_META } from './capability-meta'

const ROUTE_SEGMENT: Record<AiOverviewCapability, string> = {
  summary: 'summary',
  insights: 'insights',
  translation: 'translation',
  tts: 'tts',
}

interface AssetSectionProps {
  refId: string
  rows: AssetRow[]
  highlightId: string | null
  registerRow: (id: string, node: HTMLLIElement | null) => void
  onRegenerate: (row: AssetRow) => void
  onDelete: (row: AssetRow) => void
}

export function AssetSection(props: AssetSectionProps) {
  const { t } = useI18n()

  if (!props.rows.length) {
    return (
      <EmptyState
        description={t('ai.overview.assetsEmptyDescription')}
        title={t('ai.overview.assetsEmptyTitle')}
      />
    )
  }

  return (
    <ul className="divide-y divide-border">
      {props.rows.map((row) => {
        const meta = CAPABILITY_META[row.capability]
        const CapabilityIcon = meta.icon
        return (
          <li
            className={cn(
              'flex items-center gap-2 rounded-sm px-2 py-2 transition-colors',
              props.highlightId === row.id && 'bg-accent-soft',
            )}
            key={row.id}
            ref={(node) => props.registerRow(row.id, node)}
          >
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-inset px-2 py-0.5 text-xs text-fg-muted"
              title={t(meta.labelKey)}
            >
              <CapabilityIcon aria-hidden="true" className="size-3" />
              {t(meta.labelKey)}
            </span>
            <span className="shrink-0 rounded-full bg-surface-inset px-2 py-0.5 text-xs text-fg-muted">
              {row.lang}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
              {row.preview}
            </span>
            {row.metrics?.costTotalUsd ? (
              <span className="shrink-0 tabular-nums text-xs text-fg-subtle">
                ${row.metrics.costTotalUsd.toFixed(4)}
              </span>
            ) : null}
            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                aria-label={t('ai.overview.action.open')}
                className="inline-flex size-7 items-center justify-center rounded-xs text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
                to={`/ai/${ROUTE_SEGMENT[row.capability]}/${props.refId}`}
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
              <IconButton
                label={t('ai.overview.action.regenerate')}
                onClick={() => props.onRegenerate(row)}
              >
                <RotateCw aria-hidden="true" className="size-3.5" />
              </IconButton>
              <IconButton
                destructive
                label={t('ai.overview.action.delete')}
                onClick={() => props.onDelete(row)}
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </IconButton>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function IconButton(props: {
  label: string
  onClick: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={props.label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-xs text-fg-subtle transition-colors hover:bg-surface-inset',
        props.destructive ? 'hover:text-red-600' : 'hover:text-fg',
        'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
      )}
      onClick={props.onClick}
      type="button"
    >
      {props.children}
    </button>
  )
}
