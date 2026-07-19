import type {
  ReaderMembershipStatusFilter,
  ReaderRoleFilter,
} from '~/api/readers'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'

export const readersPageSize = 20
export const searchDebounceMs = 300

export const readersQueryKey = adminQueryKeys.readers.root

export const ROLE_TABS: {
  value: ReaderRoleFilter
  labelKey: TranslationKey
}[] = [
  { labelKey: 'readers.tab.all', value: 'all' },
  { labelKey: 'readers.tab.owners', value: 'owner' },
  { labelKey: 'readers.tab.readers', value: 'reader' },
]

export const MEMBERSHIP_STATUS_FILTERS: {
  value: 'all' | ReaderMembershipStatusFilter
  labelKey: TranslationKey
}[] = [
  { labelKey: 'readers.membership.filter.all', value: 'all' },
  { labelKey: 'readers.membership.status.active', value: 'active' },
  { labelKey: 'readers.membership.status.onHold', value: 'on_hold' },
  { labelKey: 'readers.membership.status.cancelled', value: 'cancelled' },
  { labelKey: 'readers.membership.status.expired', value: 'expired' },
  { labelKey: 'readers.membership.status.none', value: 'none' },
]
