import { shallow } from 'zustand/shallow'

import {
  selectPostCategory,
  selectPostCategories,
  selectPostList,
  selectVisiblePost,
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

export function usePostResourceCategoryIds() {
  return usePostCategoryResourceStore((state) => state.categoryIds, shallow)
}

export function usePostResourceCategory(categoryId: string) {
  return usePostCategoryResourceStore(
    (state) => (categoryId ? selectPostCategory(state, categoryId) : undefined),
    shallow,
  )
}

export function usePostResourcePost(postId: string) {
  return usePostCategoryResourceStore(
    (state) => (postId ? selectVisiblePost(state, postId) : undefined),
    shallow,
  )
}
