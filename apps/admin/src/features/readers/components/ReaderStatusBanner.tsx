import { ShieldAlert } from 'lucide-react'
import type { ReaderModel } from '~/api/readers'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { parseDate, relativeTimeFromNow } from '~/utils/time'

export function ReaderStatusBanner(props: {
  reader: ReaderModel
  onUnban: () => void
  unbanPending: boolean
}) {
  const { t } = useI18n()
  const { reader } = props
  if (!reader.bannedAt) return null

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-red-950 dark:bg-red-950/30">
      <div className="flex min-w-0 gap-3">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            <time
              dateTime={reader.bannedAt}
              title={parseDate(reader.bannedAt, 'yyyy 年 M 月 d 日 HH:mm:ss')}
            >
              {t('readers.banner.banned', {
                date: relativeTimeFromNow(reader.bannedAt),
              })}
            </time>
          </p>
          <p className="mt-1 break-words text-xs text-red-600/90 dark:text-red-400/90">
            {reader.banReason
              ? t('readers.banner.reason', { reason: reader.banReason })
              : t('readers.banner.noReason')}
          </p>
        </div>
      </div>
      <Button
        className="h-8 shrink-0 border-red-300 px-3 text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
        disabled={props.unbanPending}
        onClick={props.onUnban}
        type="button"
        variant="subtle"
      >
        {t('readers.action.unban')}
      </Button>
    </div>
  )
}
