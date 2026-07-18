import { RefreshCw, Search } from 'lucide-react'

import type { ReaderMembershipStatusFilter } from '~/api/readers'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { MEMBERSHIP_STATUS_FILTERS } from '../constants'

interface ReadersToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  membershipStatus: 'all' | ReaderMembershipStatusFilter
  onMembershipStatusChange: (
    value: 'all' | ReaderMembershipStatusFilter,
  ) => void
  onRefresh: () => void
  isFetching: boolean
}

export function ReadersToolbar(props: ReadersToolbarProps) {
  const { t } = useI18n()

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
        />
        <TextInput
          controlClassName="pl-9"
          onChange={props.onSearchChange}
          placeholder={t('readers.search.placeholder')}
          value={props.search}
        />
      </div>
      <SelectField
        aria-label={t('readers.membership.filter.label')}
        onValueChange={props.onMembershipStatusChange}
        options={MEMBERSHIP_STATUS_FILTERS.map((filter) => ({
          label: t(filter.labelKey),
          value: filter.value,
        }))}
        triggerClassName="w-36 shrink-0"
        value={props.membershipStatus}
      />
      <Button
        aria-label={t('readers.refresh')}
        disabled={props.isFetching}
        iconOnly
        onClick={props.onRefresh}
        type="button"
        variant="subtle"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn('size-4', props.isFetching && 'animate-spin')}
        />
      </Button>
    </div>
  )
}
