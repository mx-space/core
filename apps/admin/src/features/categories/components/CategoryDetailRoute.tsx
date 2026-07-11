import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { getCategories, getCategory, getTags } from '~/api/categories'
import {
  useCollectionDetailQuery,
  useCollectionListQuery,
  useEntity,
} from '~/data/resource/hooks'
import { categories } from '~/data/resources/category'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { TagModel } from '~/models/category'
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
  const ctx = useCategoriesRouteContext()

  const parsed = parseId(id)

  const category = useEntity(
    categories,
    parsed?.kind === 'category' ? parsed.value : undefined,
  )

  useCollectionDetailQuery(categories, {
    enabled: parsed?.kind === 'category',
    queryFn: () => getCategory(parsed!.value),
    queryKey: parsed?.value
      ? adminQueryKeys.categories.detail(parsed.value)
      : adminQueryKeys.categories.root,
  })

  const tagsListCacheQuery = useQuery({
    enabled: parsed?.kind === 'tag',
    queryFn: getTags,
    queryKey: TAGS_LIST_KEY,
  })

  useCollectionListQuery(categories, {
    enabled: parsed?.kind === 'category' && !category,
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: CATEGORY_LIST_KEY,
    toPage: (result) => ({ items: result }),
  })

  const dynamicTitle =
    parsed?.kind === 'tag'
      ? (tagsListCacheQuery.data?.find(
          (entry: TagModel) => entry.name === parsed.value,
        )?.name ?? parsed.value)
      : (category?.name ?? undefined)
  useDocumentTitle(dynamicTitle)

  if (!parsed) return <DetailEmpty />

  if (parsed.kind === 'tag') {
    const tag =
      tagsListCacheQuery.data?.find(
        (entry: TagModel) => entry.name === parsed.value,
      ) ?? null
    if (!tag) return <DetailEmpty />
    return <TagDetail onBack={ctx.onBack} tag={tag} />
  }

  if (!category) return <DetailEmpty />

  return (
    <CategoryDetail
      category={category}
      deleting={ctx.deleting}
      onBack={ctx.onBack}
      onDelete={ctx.onDelete}
      onEdit={ctx.onEdit}
    />
  )
}

export default CategoryDetailRoute
