import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect } from 'react'

import { getCategories, getTags } from '~/api/categories'
import { usePostResourceCategories } from '~/data/post-category-resource/hooks'
import { usePostCategoryResourceStore } from '~/data/post-category-resource/store'
import type { CategoryModel } from '~/models/category'
import { adminQueryKeys } from '~/query/keys'

export function useCategoriesList() {
  const resourceCategories = usePostResourceCategories()
  const categoriesQuery = useQuery({
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: adminQueryKeys.categories.list(),
  })
  const tagsQuery = useQuery({
    queryFn: getTags,
    queryKey: adminQueryKeys.categories.tags(),
  })

  useLayoutEffect(() => {
    if (!categoriesQuery.data) return
    usePostCategoryResourceStore
      .getState()
      .hydrateCategories(categoriesQuery.data)
  }, [categoriesQuery.data])

  return {
    categories: resourceCategories.filter(isCategoryModel),
    categoriesQuery,
    tags: tagsQuery.data ?? [],
    tagsQuery,
  }
}

function isCategoryModel(category: unknown): category is CategoryModel {
  return (
    typeof category === 'object' &&
    category !== null &&
    'count' in category &&
    'createdAt' in category
  )
}
