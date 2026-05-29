import { useQuery } from '@tanstack/react-query'

import { getCategories, getTags } from '~/api/categories'
import { adminQueryKeys } from '~/query/keys'

export function useCategoriesList() {
  const categoriesQuery = useQuery({
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: adminQueryKeys.categories.list(),
  })
  const tagsQuery = useQuery({
    queryFn: getTags,
    queryKey: adminQueryKeys.categories.tags(),
  })

  return {
    categories: categoriesQuery.data ?? [],
    categoriesQuery,
    tags: tagsQuery.data ?? [],
    tagsQuery,
  }
}
