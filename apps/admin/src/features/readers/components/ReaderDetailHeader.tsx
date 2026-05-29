import { BadgeCheck, ChevronLeft, Crown, ShieldAlert } from 'lucide-react'
import type { ReaderModel } from '~/api/readers'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

function avatarFallback(reader: ReaderModel) {
  const seed = reader.name ?? reader.handle ?? reader.id
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=random`
}

export function ReaderDetailHeader(props: {
  reader: ReaderModel
  onBack: () => void
}) {
  const { t } = useI18n()
  const { reader } = props
  const displayName = reader.name ?? reader.handle ?? reader.id
  const banned = Boolean(reader.bannedAt)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
        APP_SHELL_HEADER_HEIGHT_CLASS,
      )}
    >
      <Button
        aria-label={t('readers.detail.backAria')}
        className="h-8 px-2 lg:hidden"
        onClick={props.onBack}
        type="button"
        variant="subtle"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>

      <img
        alt=""
        className={cn(
          'size-10 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700',
          banned && 'grayscale',
        )}
        src={reader.image || avatarFallback(reader)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold leading-tight text-neutral-950 dark:text-neutral-50">
            {displayName}
          </h2>
          {reader.role === 'owner' ? (
            <span
              className="flex size-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"
              title={t('readers.role.owner')}
            >
              <Crown aria-hidden="true" className="size-3" />
            </span>
          ) : null}
          {banned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              <ShieldAlert aria-hidden="true" className="size-3" />
              {t('readers.row.banned')}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {reader.handle ? (
            <span className="truncate">@{reader.handle}</span>
          ) : null}
          {reader.email ? (
            <span className="truncate">{reader.email}</span>
          ) : null}
          <span
            className={cn(
              'inline-flex items-center gap-1',
              reader.emailVerified
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-neutral-400 dark:text-neutral-500',
            )}
          >
            <BadgeCheck aria-hidden="true" className="size-3" />
            {reader.emailVerified
              ? t('readers.detail.verified')
              : t('readers.detail.unverified')}
          </span>
        </div>
      </div>
    </div>
  )
}
