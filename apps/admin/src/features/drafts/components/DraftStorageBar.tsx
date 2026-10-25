import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftStorageSummary } from '~/models/draft'
import { Button } from '~/ui/primitives/button'

const SEGMENTS = [
  { className: 'bg-accent', key: 'revisions' },
  { className: 'bg-amber-500', key: 'crdt' },
  { className: 'bg-neutral-400', key: 'updates' },
] as const

export function DraftStorageBar(props: {
  autoCleanup: boolean | undefined
  onCleanup: () => void
  summary: DraftStorageSummary | undefined
}) {
  const { t } = useI18n()
  const { summary } = props
  const total = summary
    ? summary.revisions.bytes + summary.crdt.bytes + summary.updates.bytes
    : 0
  const labels = {
    crdt: t('drafts.storage.crdt'),
    revisions: t('drafts.storage.revisions'),
    updates: t('drafts.storage.updates'),
  }

  return (
    <section
      aria-label={t('drafts.storage.title')}
      className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-fg-muted">
            {t('drafts.storage.total')}
          </span>
          <span className="text-base font-semibold tabular-nums text-fg">
            {summary ? formatBytes(total) : '—'}
          </span>
          <span className="text-xs text-fg-muted">
            {t('drafts.storage.reclaimable')}
          </span>
          <span className="text-base font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {summary ? formatBytes(summary.reclaimableBytes) : '—'}
          </span>
        </div>
        <Button
          className="h-8 shrink-0 px-2.5"
          onClick={props.onCleanup}
          type="button"
          variant="secondary"
        >
          <Sparkles aria-hidden="true" className="size-3.5" />
          {t('drafts.cleanup.open')}
        </Button>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-inset">
        {summary && total > 0
          ? SEGMENTS.map((segment) => (
              <div
                className={segment.className}
                key={segment.key}
                style={{
                  width: `${(summary[segment.key].bytes / total) * 100}%`,
                }}
              />
            ))
          : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SEGMENTS.map((segment) => (
          <span className="flex items-center gap-1.5" key={segment.key}>
            <span
              aria-hidden="true"
              className={`size-2 rounded-sm ${segment.className}`}
            />
            {labels[segment.key]}{' '}
            {summary ? formatBytes(summary[segment.key].bytes) : '—'}
          </span>
        ))}
        <Link
          className="ml-auto text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          to="/setting/storage"
        >
          {props.autoCleanup
            ? t('drafts.autoCleanup.on')
            : t('drafts.autoCleanup.off')}
        </Link>
      </div>
    </section>
  )
}
