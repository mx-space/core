import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'

import { getCleanupPreview } from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { CleanupCategory, DraftStorageSummary } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button, ButtonLink } from '~/ui/primitives/button'

import type { CleanupSuggestion } from '../utils/cleanup-suggestions'
import { buildCleanupSuggestions } from '../utils/cleanup-suggestions'

const SUGGESTION_DAYS = 30

const SEGMENTS = [
  { className: 'bg-accent', key: 'revisions' },
  { className: 'bg-amber-500', key: 'crdt' },
  { className: 'bg-neutral-400', key: 'updates' },
] as const

export function DraftDetailEmpty(props: {
  autoCleanup: boolean | undefined
  onCleanup: (focus: CleanupCategory) => void
  storage: DraftStorageSummary | undefined
}) {
  const { t } = useI18n()
  const { storage } = props
  const previewQuery = useQuery({
    queryFn: () => getCleanupPreview(SUGGESTION_DAYS),
    queryKey: adminQueryKeys.drafts.cleanupPreview(SUGGESTION_DAYS),
  })
  const cards = buildCleanupSuggestions(previewQuery.data, props.autoCleanup)
  const total = storage
    ? storage.revisions.bytes + storage.crdt.bytes + storage.updates.bytes
    : 0
  const labels = {
    crdt: t('drafts.storage.crdt'),
    revisions: t('drafts.storage.revisions'),
    updates: t('drafts.storage.updates'),
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-fg-muted">
                {t('drafts.storage.total')}
              </span>
              <span className="text-2xl font-semibold tabular-nums text-fg">
                {storage ? formatBytes(total) : '—'}
              </span>
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-fg-muted">
                {t('drafts.storage.reclaimable')}
              </span>
              <span className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {storage ? formatBytes(storage.reclaimableBytes) : '—'}
              </span>
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-inset">
            {storage && total > 0
              ? SEGMENTS.map((segment) => (
                  <div
                    className={segment.className}
                    key={segment.key}
                    style={{
                      width: `${(storage[segment.key].bytes / total) * 100}%`,
                    }}
                  />
                ))
              : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
            {SEGMENTS.map((segment) => (
              <span className="flex items-center gap-1.5" key={segment.key}>
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-xs ${segment.className}`}
                />
                {labels[segment.key]}{' '}
                {storage ? formatBytes(storage[segment.key].bytes) : '—'}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">
            {t('drafts.overview.suggestions')}
          </h3>
          {cards.length === 0 && previewQuery.data ? (
            <p className="rounded-lg bg-surface-inset px-4 py-6 text-center text-sm text-fg-subtle">
              {t('drafts.overview.allClean')}
            </p>
          ) : null}
          {cards.map((card) => (
            <SuggestionCard
              card={card}
              key={card.kind}
              onCleanup={props.onCleanup}
            />
          ))}
        </section>
        <p className="text-center text-xs text-fg-subtle">
          {t('drafts.detail.empty')}
        </p>
      </div>
    </div>
  )
}

function SuggestionCard(props: {
  card: CleanupSuggestion
  onCleanup: (focus: CleanupCategory) => void
}) {
  const { t } = useI18n()
  const { card } = props
  const days = SUGGESTION_DAYS

  const copy =
    card.kind === 'auto'
      ? {
          description: t('drafts.overview.auto.description'),
          title: t('drafts.overview.auto.title'),
        }
      : card.kind === 'E'
        ? {
            description: t('drafts.overview.E.description', {
              days,
              samples: card.samples
                .map((title) => title || t('drafts.row.untitled'))
                .join('、'),
            }),
            title: t('drafts.overview.E.title', { count: card.count }),
          }
        : {
            description: t(`drafts.overview.${card.kind}.description`, {
              size: formatBytes(card.bytes),
            }),
            title: t(`drafts.overview.${card.kind}.title`, {
              count: card.count,
              days,
            }),
          }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-card px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{copy.title}</span>
        <span className="truncate text-xs text-fg-muted">
          {copy.description}
        </span>
      </div>
      {card.kind === 'auto' ? (
        <ButtonLink className="h-8 shrink-0 px-3" to="/setting/storage">
          {t('drafts.overview.enable')}
        </ButtonLink>
      ) : (
        <Button
          className="h-8 shrink-0 px-3"
          onClick={() => props.onCleanup(card.kind)}
          type="button"
          variant="secondary"
        >
          {card.kind === 'B'
            ? t('drafts.overview.clean')
            : t('drafts.overview.view')}
        </Button>
      )}
    </div>
  )
}

export function DraftDetailPlaceholder() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-[24rem] items-center justify-center px-4">
      <EmptyState icon={Inbox} title={t('drafts.detail.empty')} />
    </div>
  )
}
