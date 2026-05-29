import type { TranslationKey } from '~/i18n/types'
import type { PostSortKey } from './types/posts'

export const allCategoriesValue = '__all__'
export const postsPageSize = 20

export const postSortOptionDefinitions: Array<{
  labelKey: TranslationKey
  value: PostSortKey
}> = [
  { labelKey: 'posts.sort.createdAt', value: 'createdAt' },
  { labelKey: 'posts.sort.modifiedAt', value: 'modifiedAt' },
  { labelKey: 'posts.sort.pinAt', value: 'pinAt' },
]
