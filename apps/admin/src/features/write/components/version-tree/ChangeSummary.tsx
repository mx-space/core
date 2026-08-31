import { useI18n } from '~/i18n'
import type { ContentRevision } from '~/models/draft'

import { formatCharCount, summarizeRevisionChange } from './change-summary'

const MAX_FIELDS = 2

export function ChangeSummary(props: {
  base: ContentRevision
  head: ContentRevision
}) {
  const { t } = useI18n()
  const summary = summarizeRevisionChange(props.base, props.head)
  const shown = summary.fieldKeys.slice(0, MAX_FIELDS).map((key) => t(key))
  const rest = summary.fieldKeys.length - shown.length
  const fields =
    shown.length > 0
      ? t('write.versionTree.fieldsChanged', {
          fields: [
            shown.join('、'),
            rest > 0 ? t('write.versionTree.fieldsMore', { count: rest }) : '',
          ]
            .filter(Boolean)
            .join(''),
        })
      : summary.charDelta === 0
        ? t('write.versionTree.noChange')
        : t('write.versionTree.bodyOnly')

  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-sm text-fg">
      {summary.charDelta === 0 ? null : (
        <span
          className={
            summary.charDelta > 0
              ? 'shrink-0 font-medium tabular-nums text-emerald-700 dark:text-emerald-400'
              : 'shrink-0 font-medium tabular-nums text-red-700 dark:text-red-400'
          }
        >
          {t(
            summary.charDelta > 0
              ? 'write.versionTree.charsAdded'
              : 'write.versionTree.charsRemoved',
            { count: formatCharCount(Math.abs(summary.charDelta)) },
          )}
        </span>
      )}
      <span className="truncate text-fg-muted">{fields}</span>
    </span>
  )
}

export function TitleChangeLine(props: {
  base: ContentRevision
  head: ContentRevision
}) {
  const { t } = useI18n()
  if (props.base.title === props.head.title) return null

  return (
    <span className="block truncate text-xs text-fg-muted">
      {t('write.versionTree.titleChangedTo', {
        title: props.head.title || t('write.editor.untitled'),
      })}
    </span>
  )
}
