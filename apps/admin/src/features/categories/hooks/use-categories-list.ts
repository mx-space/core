import { useQuery } from '@tanstack/react-query'

import { getCategories, getTags } from '~/api/categories'
import { usePostResourceCategories } from '~/data/post-category-resource/hooks'
import { usePostCategoriesResourceQuery } from '~/data/post-category-resource/queries'
import type { CategoryModel } from '~/models/category'
import { adminQueryKeys } from '~/query/keys'

export function useCategoriesList() {
  const resourceCategories = usePostResourceCategories()
  const categoriesQuery = usePostCategoriesResourceQuery({
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: adminQueryKeys.categories.list(),
  })
  const tagsQuery = useQuery({
    queryFn: getTags,
    queryKey: adminQueryKeys.categories.tags(),
  })

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
