import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect } from 'react'
import { useParams } from 'react-router'

import { getCategories, getCategory, getTags } from '~/api/categories'
import { findInListCache } from '~/api/list-cache'
import { usePostResourceCategory } from '~/data/post-category-resource/hooks'
import { usePostCategoryResourceStore } from '~/data/post-category-resource/store'
import type { CategoryModel, TagModel } from '~/models/category'
import { adminQueryKeys } from '~/query/keys'

import { useCategoriesRouteContext } from './categories-route-context'
import { CategoryDetail } from './CategoryDetail'
import { DetailEmpty } from './DetailEmpty'
import { TagDetail } from './TagDetail'

const CATEGORY_LIST_KEY = adminQueryKeys.categories.list()
const TAGS_LIST_KEY = adminQueryKeys.categories.tags()

interface ParsedTarget {
  kind: 'category' | 'tag'
  value: string
}

function parseId(raw: string | undefined): ParsedTarget | null {
  if (!raw) return null
  if (raw.startsWith('c-')) return { kind: 'category', value: raw.slice(2) }
  if (raw.startsWith('t-')) {
    return { kind: 'tag', value: decodeURIComponent(raw.slice(2)) }
  }
  // Backward-compatible: bare id treated as category.
  return { kind: 'category', value: raw }
}

export function CategoryDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useCategoriesRouteContext()

  const parsed = parseId(id)
  const resourceCategory = usePostResourceCategory(
    parsed?.kind === 'category' ? parsed.value : '',
  )

  const initialCategory =
    parsed?.kind === 'category'
      ? findInListCache<CategoryModel>(
          queryClient,
          CATEGORY_LIST_KEY,
          parsed.value,
        )
      : undefined

  const categoryQuery = useQuery({
    enabled: parsed?.kind === 'category',
    initialData: initialCategory,
    queryFn: () => getCategory(parsed!.value),
    queryKey: parsed?.value
      ? adminQueryKeys.categories.detail(parsed.value)
      : adminQueryKeys.categories.root,
    staleTime: initialCategory ? 30_000 : 0,
  })

  // Tag detail isn't fetched by id; reach into the list cache to find it.
  const tagsListCacheQuery = useQuery({
    enabled: parsed?.kind === 'tag',
    queryFn: getTags,
    queryKey: TAGS_LIST_KEY,
  })

  // Keep the categories list warm in case the user opened a deep link directly.
  useQuery({
    enabled: parsed?.kind === 'category' && !initialCategory,
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: CATEGORY_LIST_KEY,
  })

  useLayoutEffect(() => {
    if (!categoryQuery.data) return
    usePostCategoryResourceStore.getState().hydrateCategory(categoryQuery.data)
  }, [categoryQuery.data])

  if (!parsed) return <DetailEmpty />

  if (parsed.kind === 'tag') {
    const tag =
      tagsListCacheQuery.data?.find(
        (entry: TagModel) => entry.name === parsed.value,
      ) ?? null
    if (!tag) return <DetailEmpty />
    return <TagDetail onBack={ctx.onBack} tag={tag} />
  }

  const category = (resourceCategory ?? categoryQuery.data) as
    | CategoryModel
    | undefined
  if (!category) return <DetailEmpty />

  return (
    <CategoryDetail
      categoryId={category.id}
      deleting={ctx.deleting}
      onBack={ctx.onBack}
      onDelete={ctx.onDelete}
      onEdit={ctx.onEdit}
    />
  )
}

export default CategoryDetailRoute
