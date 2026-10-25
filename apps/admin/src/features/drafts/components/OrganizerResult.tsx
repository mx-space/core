import { Check, CircleAlert, Clock3 } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { OrganizerArticle, OrganizerRunResult } from '~/models/draft'
import { Button, ButtonLink } from '~/ui/primitives/button'

const REASONS = {
  changed: 'drafts.organizer.reason.changed',
  editing: 'drafts.organizer.reason.editing',
  publishing: 'drafts.organizer.reason.publishing',
  unconfirmed: 'drafts.organizer.reason.unconfirmed',
  failed: 'drafts.organizer.reason.failed',
} as const

export function OrganizerResult(props: {
  result: OrganizerRunResult
  items: OrganizerArticle[]
  onReview: () => void
}) {
  const { t } = useI18n()
  const { result } = props
  const titles = new Map(
    props.items.map((item) => [item.documentId, item.title]),
  )
  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-surface-card p-5 shadow-xs sm:p-8">
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        {result.unverified.length ? (
          <CircleAlert aria-hidden="true" className="size-6" />
        ) : (
          <Check aria-hidden="true" className="size-6" />
        )}
      </span>
      <h2 className="text-2xl font-semibold text-fg">
        {t(
          result.unverified.length
            ? 'drafts.organizer.interrupted'
            : 'drafts.organizer.doneTitle',
        )}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        {t('drafts.organizer.doneDescription', {
          count: result.organized,
          skipped: result.skipped.length,
        })}
      </p>
      <dl className="my-6 grid grid-cols-3 divide-x divide-border border-y border-border py-5">
        {[
          [formatBytes(result.freed.bytes), t('drafts.organizer.actualBytes')],
          [result.freed.drafts, t('drafts.organizer.removedDrafts')],
          [result.freed.revisions, t('drafts.organizer.removedRevisions')],
        ].map(([value, label]) => (
          <div className="px-3 first:pl-0" key={label}>
            <dd className="text-xl font-semibold tabular-nums text-fg">
              {value}
            </dd>
            <dt className="mt-1 text-xs text-fg-subtle">{label}</dt>
          </div>
        ))}
      </dl>
      <p className="mb-5 flex items-start gap-2 text-sm text-fg-muted">
        <Check
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-emerald-600"
        />
        {t('drafts.organizer.kept')}
      </p>
      {result.unverified.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="text-sm font-semibold">
            {t('drafts.organizer.unverifiedTitle', {
              count: result.unverified.length,
            })}
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            {t('drafts.organizer.unverifiedHint')}
          </p>
        </div>
      )}
      {result.skipped.length > 0 && (
        <section className="rounded-md border border-border bg-surface-inset p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
            <Clock3
              aria-hidden="true"
              className="size-4 text-amber-700 dark:text-amber-400"
            />
            {t('drafts.organizer.skippedTitle', {
              count: result.skipped.length,
            })}
          </h3>
          <p className="mt-1 text-xs text-fg-subtle">
            {t('drafts.organizer.skippedHint')}
          </p>
          <ul className="mt-3 max-h-60 divide-y divide-border overflow-auto">
            {result.skipped.map((item) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                key={item.documentId}
              >
                <span className="text-fg">
                  {item.title ||
                    titles.get(item.documentId) ||
                    t('drafts.row.untitled')}
                </span>
                <span className="text-xs text-fg-muted">
                  {t(REASONS[item.reason])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {(result.skipped.length > 0 || result.unverified.length > 0) && (
          <Button onClick={props.onReview} variant="secondary">
            {t('drafts.organizer.reviewRemaining')}
          </Button>
        )}
        <ButtonLink to="/drafts">{t('drafts.organizer.backDrafts')}</ButtonLink>
      </div>
    </div>
  )
}
