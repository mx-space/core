import type { SearchIndexRefType } from '~/api/search-index'
import type { TranslationKey } from '~/i18n/types'

export const searchIndexQueryKey = ['search-index'] as const

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

export const refTypeClassNames: Record<string, string> = {
  note: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  page: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  post: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
}
