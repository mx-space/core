import type { ApiClient } from '../../core/api-client'
import { NameResolver, type ResolvableItem } from '../../core/resolve'

export function buildResolver(client: ApiClient): NameResolver {
  return new NameResolver({
    fetchCategories: async () => {
      const res = await client.request<
        { data: ResolvableItem[] } | ResolvableItem[]
      >('/categories')
      const data = Array.isArray(res.data) ? res.data : res.data?.data
      return Array.isArray(data) ? data : []
    },
    fetchTopics: async () => {
      const res = await client.request<
        { data: ResolvableItem[] } | ResolvableItem[]
      >('/topics/all')
      const data = Array.isArray(res.data) ? res.data : res.data?.data
      return Array.isArray(data) ? data : []
    },
  })
}

export async function resolveCategoryRefs(
  payload: Record<string, unknown>,
  resolver: NameResolver,
): Promise<void> {
  const nameRef = payload.__categoryName
  delete payload.__categoryName
  if (
    typeof nameRef === 'string' &&
    nameRef.length > 0 &&
    !payload.categoryId
  ) {
    payload.categoryId = await resolver.resolveCategory(nameRef)
  }
}

export async function resolveTopicRefs(
  payload: Record<string, unknown>,
  resolver: NameResolver,
): Promise<void> {
  const nameRef = payload.__topicName
  delete payload.__topicName
  if (typeof nameRef === 'string' && nameRef.length > 0 && !payload.topicId) {
    payload.topicId = await resolver.resolveTopic(nameRef)
  }
}
