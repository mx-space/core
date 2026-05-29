import type { SearchIndexRefType } from '~/api/search-index'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'
import type { BadgeTone } from '~/ui/primitives/badge'

export const searchIndexQueryKey = adminQueryKeys.searchIndex.root
export const searchIndexPageSizeOptions = [20, 50, 100] as const

export const refTypeOptionKeys: Array<{
  labelKey: TranslationKey
  value: SearchIndexRefType | ''
}> = [
  { labelKey: 'searchIndex.refType.all', value: '' },
  { labelKey: 'searchIndex.refType.post', value: 'post' },
  { labelKey: 'searchIndex.refType.note', value: 'note' },
  { labelKey: 'searchIndex.refType.page', value: 'page' },
]

export const refTypeLabelKeys: Record<string, TranslationKey> = {
  note: 'searchIndex.refTypeLabel.note',
  page: 'searchIndex.refTypeLabel.page',
  post: 'searchIndex.refTypeLabel.post',
}

export const refTypeTones: Record<string, BadgeTone> = {
  note: 'success',
  page: 'warning',
  post: 'info',
}
