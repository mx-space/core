import type { StateTab } from './types/friends'

import { LinkState } from '~/models/link'

export const friendsQueryKey = ['links'] as const
export const friendsPageSize = 50

export const stateTabs: StateTab[] = [
  {
    countKey: 'friends',
    labelKey: 'friends.tab.friends',
    value: LinkState.Pass,
  },
  { countKey: 'audit', labelKey: 'friends.tab.audit', value: LinkState.Audit },
  {
    countKey: 'outdate',
    labelKey: 'friends.tab.outdate',
    value: LinkState.Outdate,
  },
  {
    countKey: 'reject',
    labelKey: 'friends.tab.reject',
    value: LinkState.Reject,
  },
  {
    countKey: 'banned',
    labelKey: 'friends.tab.banned',
    value: LinkState.Banned,
  },
]
