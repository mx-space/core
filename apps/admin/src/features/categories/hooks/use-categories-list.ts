import { useQuery } from '@tanstack/react-query'

import { getCategories, getTags } from '~/api/categories'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { categories } from '~/data/resources/category'
import { adminQueryKeys } from '~/query/keys'

export function useCategoriesList() {
  const categoriesQuery = useCollectionListQuery(categories, {
    queryKey: adminQueryKeys.categories.list(),
    queryFn: () => getCategories({ type: 'Category' }),
    toPage: (result) => ({ items: result }),
  })
  const categoriesList = useEntityList(
    categories,
    adminQueryKeys.categories.list(),
  )

  const tagsQuery = useQuery({
    queryFn: getTags,
    queryKey: adminQueryKeys.categories.tags(),
  })

  return {
    categories: categoriesList.items,
    categoriesQuery,
    tags: tagsQuery.data ?? [],
    tagsQuery,
  }
}
