import type { ReaderModel } from '~/api/readers'
import type { TranslationKey } from '~/i18n/types'

import { useI18n } from '~/i18n'
import { parseDate, relativeTimeFromNow } from '~/utils/time'

function ActivityRow(props: { label: string; value: string | null }) {
  const { t } = useI18n()
  const absolute = props.value
    ? parseDate(props.value, 'yyyy 年 M 月 d 日 HH:mm:ss')
    : undefined

  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
        {props.label}
      </span>
      {props.value ? (
        <time
          className="min-w-0 truncate text-right text-sm text-neutral-800 dark:text-neutral-200"
          dateTime={props.value}
          title={absolute}
        >
          {relativeTimeFromNow(props.value)}
        </time>
      ) : (
        <span className="text-right text-sm text-neutral-400">
          {t('readers.row.lastLoginNever')}
        </span>
      )}
    </div>
  )
}

export function ReaderActivityBlock(props: { reader: ReaderModel }) {
  const { t } = useI18n()
  const { reader } = props

  const rows: { labelKey: TranslationKey; value: string | null }[] = [
    { labelKey: 'readers.detail.field.joined', value: reader.createdAt },
    { labelKey: 'readers.detail.field.lastLogin', value: reader.lastLoginAt },
    { labelKey: 'readers.detail.field.updated', value: reader.updatedAt },
  ]

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {t('readers.detail.section.activity')}
      </h3>
      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 px-3 dark:divide-neutral-800 dark:border-neutral-800">
        {rows.map((row) => (
          <ActivityRow
            key={row.labelKey}
            label={t(row.labelKey)}
            value={row.value}
          />
        ))}
      </div>
    </section>
  )
}
