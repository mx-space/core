import { shallow } from 'zustand/shallow'

import {
  selectPostCategories,
  selectPostList,
  serializeResourceListKey,
  usePostCategoryResourceStore,
} from './store'

export function usePostResourceList(queryKey: readonly unknown[]) {
  const listKey = serializeResourceListKey(queryKey)
  return usePostCategoryResourceStore(
    (state) => selectPostList(state, listKey),
    shallow,
  )
}

export function usePostResourceCategories() {
  return usePostCategoryResourceStore(selectPostCategories, shallow)
}
