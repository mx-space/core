import type { ReaderRoleFilter } from '~/api/readers'
import type { TranslationKey } from '~/i18n/types'

export const readersPageSize = 20
export const searchDebounceMs = 300

export const readersQueryKey = ['readers'] as const

export const ROLE_TABS: {
  value: ReaderRoleFilter
  labelKey: TranslationKey
}[] = [
  { labelKey: 'readers.tab.all', value: 'all' },
  { labelKey: 'readers.tab.owners', value: 'owner' },
  { labelKey: 'readers.tab.readers', value: 'reader' },
]
