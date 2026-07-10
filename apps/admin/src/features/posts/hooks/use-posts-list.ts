import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { getCategories } from '~/api/categories'
import { getPosts, searchPosts } from '~/api/posts'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { categories } from '~/data/resources/category'
import { posts } from '~/data/resources/post'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import type { Pager } from '~/models/base'
import type { PostModel } from '~/models/post'
import { adminQueryKeys } from '~/query/keys'

import { allCategoriesValue, postsPageSize, postsQueryKey } from '../constants'
import type { PostSortKey, SortOrder } from '../types/posts'
import {
  readPage,
  readPostSortKey,
  readSortOrder,
} from '../utils/search-params'

interface PostsListState {
  categoryId: string
  keyword: string
  page: number
  sortKey: PostSortKey
  sortOrder: SortOrder
}

export function usePostsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): PostsListState => ({
        categoryId: searchParams.get('category') ?? allCategoriesValue,
        keyword: searchParams.get('keyword') ?? '',
        page: readPage(searchParams.get('page')),
        sortKey: readPostSortKey(searchParams.get('sort')),
        sortOrder: readSortOrder(searchParams.get('order')),
      }),
      write: (state: PostsListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        if (state.keyword) nextParams.set('keyword', state.keyword)
        if (state.categoryId !== allCategoriesValue) {
          nextParams.set('category', state.categoryId)
        }
        if (state.sortKey !== 'createdAt') nextParams.set('sort', state.sortKey)
        if (state.sortOrder !== 'desc') nextParams.set('order', state.sortOrder)
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)
  const [keywordInput, setKeywordInput] = useState(state.keyword)

  useEffect(() => {
    setKeywordInput(state.keyword)
  }, [state.keyword])

  const categoriesQuery = useCollectionListQuery(categories, {
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: adminQueryKeys.categories.postFilter(),
    toPage: (result) => ({ items: result }),
  })
  const categoriesList = useEntityList(
    categories,
    adminQueryKeys.categories.postFilter(),
  )

  const postsListKey = adminQueryKeys.posts.list({
    categoryId: state.categoryId,
    keyword: state.keyword,
    page: state.page,
    size: postsPageSize,
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
  })
  const collectionQuery = useCollectionListQuery(posts, {
    enabled: !state.keyword,
    queryFn: () =>
      getPosts({
        categoryIds:
          state.categoryId === allCategoriesValue
            ? undefined
            : [state.categoryId],
        page: state.page,
        size: postsPageSize,
        sort_by: state.sortKey,
        sort_order: state.sortOrder,
      }),
    queryKey: postsListKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })
  const postsList = useEntityList(posts, postsListKey, { keepPrevious: true })

  const searchQuery = useQuery({
    enabled: !!state.keyword,
    placeholderData: (previous) => previous,
    queryFn: () =>
      searchPosts({
        keyword: state.keyword,
        page: state.page,
        size: postsPageSize,
      }),
    queryKey: [...postsListKey, 'search'],
  })

  const postsQuery = state.keyword ? searchQuery : collectionQuery
  const searchItems: PostModel[] = state.keyword
    ? (searchQuery.data?.data ?? [])
    : []
  const searchPagination: Pager | undefined = state.keyword
    ? searchQuery.data?.pagination
    : undefined

  return {
    categories: categoriesList.items,
    categoriesQuery,
    categoryId: state.categoryId,
    clearSearch: () => {
      setKeywordInput('')
      setState((current) => ({ ...current, keyword: '', page: 1 }))
    },
    keyword: state.keyword,
    keywordInput,
    page: state.page,
    pagination: state.keyword ? searchPagination : postsList.pagination,
    posts: state.keyword ? searchItems : postsList.items,
    postsQuery,
    rootQueryKey: postsQueryKey,
    setCategoryId: (categoryId: string) =>
      setState((current) => ({ ...current, categoryId, page: 1 })),
    setKeywordInput,
    setPage: (page: number) => setState({ page }),
    setSort: (next: { field: PostSortKey; order: SortOrder }) =>
      setState((current) => ({
        ...current,
        page: 1,
        sortKey: next.field,
        sortOrder: next.order,
      })),
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    submitSearch: () =>
      setState((current) => ({
        ...current,
        keyword: keywordInput.trim(),
        page: 1,
      })),
  }
}
