import type { ReaderMembershipStatusFilter } from '~/api/readers'
import { ContentListToolbar } from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import { SelectField } from '~/ui/primitives/select'

import { MEMBERSHIP_STATUS_FILTERS } from '../constants'

interface ReadersToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  membershipStatus: 'all' | ReaderMembershipStatusFilter
  onMembershipStatusChange: (
    value: 'all' | ReaderMembershipStatusFilter,
  ) => void
}

export function ReadersToolbar(props: ReadersToolbarProps) {
  const { t } = useI18n()

  return (
    <ContentListToolbar
      filters={
        <SelectField
          aria-label={t('readers.membership.filter.label')}
          onValueChange={props.onMembershipStatusChange}
          options={MEMBERSHIP_STATUS_FILTERS.map((filter) => ({
            label: t(filter.labelKey),
            value: filter.value,
          }))}
          triggerClassName="w-32 !h-7 !border-transparent !bg-transparent text-xs hover:!bg-neutral-100 dark:hover:!bg-neutral-900"
          value={props.membershipStatus}
        />
      }
      hasSearch={props.search.length > 0}
      onClearSearch={() => props.onSearchChange('')}
      onSearch={(event) => event.preventDefault()}
      onSearchValueChange={props.onSearchChange}
      searchPlaceholder={t('readers.search.placeholder')}
      searchValue={props.search}
    />
  )
}
