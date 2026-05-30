import { useQuery } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import type { PaginateResult } from '~/models/base'
import type { PostModel } from '~/models/post'

import {
  serializeResourceListKey,
  usePostCategoryResourceStore,
} from './store'
import type { ResourceCategory } from './store'

interface ResourceQueryOptions<TResult> {
  enabled?: boolean
  queryFn: () => Promise<TResult>
  queryKey: QueryKey
}

interface PostListResourceQueryOptions<TResult>
  extends ResourceQueryOptions<TResult> {
  toPaginatedResult?: (result: TResult) => PaginateResult<PostModel>
}

export interface ResourceQueryReceipt {
  hydratedAt: number
}

export function usePostCategoriesResourceQuery(
  options: ResourceQueryOptions<ResourceCategory[]>,
) {
  return useQuery({
    enabled: options.enabled,
    queryFn: async () => {
      const categories = await options.queryFn()
      usePostCategoryResourceStore.getState().hydrateCategories(categories)
      return createReceipt()
    },
    queryKey: options.queryKey,
  })
}

export function usePostCategoryResourceQuery(
  options: ResourceQueryOptions<ResourceCategory>,
) {
  return useQuery({
    enabled: options.enabled,
    queryFn: async () => {
      const category = await options.queryFn()
      usePostCategoryResourceStore.getState().hydrateCategory(category)
      return createReceipt()
    },
    queryKey: options.queryKey,
  })
}

export function usePostDetailResourceQuery(
  options: ResourceQueryOptions<PostModel>,
) {
  return useQuery({
    enabled: options.enabled,
    queryFn: async () => {
      const post = await options.queryFn()
      usePostCategoryResourceStore.getState().hydratePostDetail(post)
      return createReceipt()
    },
    queryKey: options.queryKey,
  })
}

export function usePostListResourceQuery<TResult = PaginateResult<PostModel>>(
  options: PostListResourceQueryOptions<TResult>,
) {
  return useQuery({
    enabled: options.enabled,
    queryFn: async () => {
      const result = await options.queryFn()
      const paginatedResult = options.toPaginatedResult
        ? options.toPaginatedResult(result)
        : (result as PaginateResult<PostModel>)

      usePostCategoryResourceStore
        .getState()
        .hydratePostList(
          serializeResourceListKey(options.queryKey),
          paginatedResult,
        )

      return createReceipt()
    },
    queryKey: options.queryKey,
  })
}

function createReceipt(): ResourceQueryReceipt {
  return { hydratedAt: Date.now() }
}
