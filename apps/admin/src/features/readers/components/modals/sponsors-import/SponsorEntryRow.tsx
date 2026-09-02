import { useI18n } from '~/i18n'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { effectiveMembershipStatus } from '../../../utils/membership-status'
import type { SponsorEntry } from './types'

export function SponsorEntryRow(props: {
  entry: SponsorEntry
  checked: boolean
  months: string
  onCheckedChange: (checked: boolean) => void
  onMonthsChange: (value: string) => void
}) {
  const { t } = useI18n()
  const { entry } = props
  const reader = entry.reader
  const membershipStatus = reader
    ? effectiveMembershipStatus(reader.membership)
    : null

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-2 text-sm',
        !reader && 'opacity-50',
      )}
    >
      <Checkbox
        checked={props.checked}
        disabled={!reader}
        onCheckedChange={props.onCheckedChange}
      />
      {entry.avatarUrl ? (
        <img
          alt=""
          className="size-7 shrink-0 rounded-full"
          src={entry.avatarUrl}
        />
      ) : (
        <div className="size-7 shrink-0 rounded-full bg-surface-inset" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-fg">{entry.title}</span>
          {entry.badge ? (
            <span
              className={cn(
                'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]',
                entry.badge === 'active'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-neutral-500/10 text-neutral-500',
              )}
            >
              {t(
                entry.badge === 'active'
                  ? 'readers.sponsors.import.active'
                  : 'readers.sponsors.import.past',
              )}
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {entry.subtitle ?? '—'}
          {' · '}
          {reader
            ? `${reader.name ?? reader.handle ?? reader.id}${
                membershipStatus && membershipStatus !== 'none'
                  ? ` (${membershipStatus})`
                  : ''
              }`
            : t('readers.sponsors.import.unregistered')}
        </div>
      </div>
      {reader ? (
        <div className="flex shrink-0 items-center gap-1">
          <TextInput
            controlClassName="w-16 text-right tabular-nums"
            inputMode="numeric"
            min={1}
            onChange={props.onMonthsChange}
            type="number"
            value={props.months}
          />
          <span className="text-xs text-neutral-500">
            {t('readers.sponsors.import.months')}
          </span>
        </div>
      ) : null}
    </div>
  )
}
