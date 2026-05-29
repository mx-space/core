import type { TranslationKey } from '~/i18n/types'

import {
  SubscribeNoteCreateBit,
  SubscribePostCreateBit,
  SubscribeRecentCreateBit,
  SubscribeSayCreateBit,
} from '~/api/subscribe'

export const pageSize = 50

export const subscribeBits: Array<{
  bit: number
  className: string
  labelKey: TranslationKey
}> = [
  {
    bit: SubscribePostCreateBit,
    className:
      'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    labelKey: 'subscribe.bit.post',
  },
  {
    bit: SubscribeNoteCreateBit,
    className:
      'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400',
    labelKey: 'subscribe.bit.note',
  },
  {
    bit: SubscribeRecentCreateBit,
    className:
      'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    labelKey: 'subscribe.bit.recent',
  },
  {
    bit: SubscribeSayCreateBit,
    className:
      'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    labelKey: 'subscribe.bit.say',
  },
]
