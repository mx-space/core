import { Archive, Loader2 } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { CompactPreview, DraftCard } from '~/models/draft'
import { Button } from '~/ui/primitives/button'

export function DraftStoragePanel(props: {
  busy: boolean
  card: DraftCard
  onCompact: () => void
  preview: CompactPreview | undefined
}) {
  const { t } = useI18n()
  const { storage } = props.card
  const reclaim = props.preview
    ? props.preview.revisionBytes + props.preview.crdtBytes
    : 0
  const stats = [
    {
      hint: props.preview
        ? t('drafts.storagePanel.revisionsHint', {
            count: props.preview.revisionIds.length,
          })
        : null,
      label: t('drafts.storage.revisions'),
      value: t('drafts.storagePanel.revisionsValue', {
        count: storage.revisionCount,
        size: formatBytes(storage.revisionBytes),
      }),
    },
    {
      hint:
        props.preview && storage.crdtBytes > 0
          ? t('drafts.storagePanel.crdtHint', {
              size: formatBytes(
                Math.max(0, storage.crdtBytes - props.preview.crdtBytes),
              ),
            })
          : null,
      label: t('drafts.storage.crdt'),
      value: storage.crdtBytes > 0 ? formatBytes(storage.crdtBytes) : '—',
    },
  ]

  return (
    <section
      aria-label={t('drafts.storage.title')}
      className="flex shrink-0 flex-wrap items-stretch gap-3 border-b border-border px-4 py-3"
    >
      {stats.map((stat) => (
        <div
          className="flex min-w-36 flex-col gap-0.5 rounded-md border border-border bg-surface-card px-3 py-2"
          key={stat.label}
        >
          <span className="text-xs text-fg-muted">{stat.label}</span>
          <span className="text-sm font-semibold tabular-nums text-fg">
            {stat.value}
          </span>
          {stat.hint ? (
            <span className="text-xs text-fg-muted">{stat.hint}</span>
          ) : null}
        </div>
      ))}
      <div className="ml-auto flex items-center">
        <Button
          disabled={props.busy || !props.preview || reclaim === 0}
          onClick={props.onCompact}
          type="button"
          variant="secondary"
        >
          {props.busy ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Archive aria-hidden="true" className="size-4" />
          )}
          {reclaim > 0
            ? t('drafts.compact.actionWithSize', { size: formatBytes(reclaim) })
            : t('drafts.compact.action')}
        </Button>
      </div>
    </section>
  )
}
