import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { getCategories } from '~/api/categories'
import { deletePost, getPosts, patchPost, searchPosts } from '~/api/posts'
import { WEB_URL } from '~/constants/env'
import {
  ContentListHeader,
  ContentListToolbar,
  SortMenu,
} from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { PostModel } from '~/models/post'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { useListKeyboard } from '~/ui/list-actions'
import { ButtonLink } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import {
  allCategoriesValue,
  postSortOptionDefinitions,
  postsPageSize,
} from '../constants'
import type { PostSortKey, SortOrder } from '../types/posts'
import { getErrorMessage } from '../utils/errors'
import {
  readPage,
  readPostSortKey,
  readSortOrder,
} from '../utils/search-params'
import { buildPostActions } from './buildPostActions'
import { PostRow } from './PostRow'
import { PostsEmpty } from './PostsEmpty'
import { PostsError } from './PostsError'
import { PostsSkeleton } from './PostsSkeleton'

const FOCUS_SCOPE_ID = 'posts-list'

export function PostsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(readPage(searchParams.get('page')))
  const [keywordInput, setKeywordInput] = useState(
    searchParams.get('keyword') ?? '',
  )
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')
  const [categoryId, setCategoryId] = useState(
    searchParams.get('category') ?? allCategoriesValue,
  )
  const [sortKey, setSortKey] = useState<PostSortKey>(
    readPostSortKey(searchParams.get('sort')),
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    readSortOrder(searchParams.get('order')),
  )
  const searchParamsKey = searchParams.toString()

  useLayoutEffect(() => {
    const nextPage = readPage(searchParams.get('page'))
    const nextKeyword = searchParams.get('keyword') ?? ''
    const nextCategoryId = searchParams.get('category') ?? allCategoriesValue
    const nextSortKey = readPostSortKey(searchParams.get('sort'))
    const nextSortOrder = readSortOrder(searchParams.get('order'))

    setPage((value) => (value === nextPage ? value : nextPage))
    setKeyword((value) => (value === nextKeyword ? value : nextKeyword))
    setKeywordInput((value) => (value === nextKeyword ? value : nextKeyword))
    setCategoryId((value) =>
      value === nextCategoryId ? value : nextCategoryId,
    )
    setSortKey((value) => (value === nextSortKey ? value : nextSortKey))
    setSortOrder((value) => (value === nextSortOrder ? value : nextSortOrder))
  }, [searchParamsKey])

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (page > 1) nextParams.set('page', String(page))
    if (keyword) nextParams.set('keyword', keyword)
    if (categoryId !== allCategoriesValue)
      nextParams.set('category', categoryId)
    if (sortKey !== 'createdAt') nextParams.set('sort', sortKey)
    if (sortOrder !== 'desc') nextParams.set('order', sortOrder)
    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    categoryId,
    keyword,
    page,
    searchParamsKey,
    setSearchParams,
    sortKey,
    sortOrder,
  ])

  const categoriesQuery = useQuery({
    queryFn: () => getCategories({ type: 'Category' }),
    queryKey: ['categories', 'post-filter'],
  })

  const postsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      keyword
        ? searchPosts({ keyword, page, size: postsPageSize })
        : getPosts({
            categoryIds:
              categoryId === allCategoriesValue ? undefined : [categoryId],
            page,
            size: postsPageSize,
            sort_by: sortKey,
            sort_order: sortOrder,
          }),
    queryKey: [
      'posts',
      'list',
      page,
      postsPageSize,
      keyword,
      categoryId,
      sortKey,
      sortOrder,
    ],
  })

  const posts = postsQuery.data?.data ?? []
  const pagination = postsQuery.data?.pagination

  // selection is created by useListKeyboard below, after `actions` is built.
  // mutations that fire `selection.clear()` go through this ref to avoid TDZ.
  const selectionClearRef = useRef<(() => void) | null>(null)

  const invalidatePosts = async () => {
    await queryClient.invalidateQueries({ queryKey: ['posts'] })
  }

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; isPublished: boolean }) =>
      patchPost(payload.id, { isPublished: payload.isPublished }),
    onSuccess: invalidatePosts,
  })

  const categoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string; id: string }) =>
      patchPost(payload.id, { categoryId: payload.categoryId }),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('posts.toast.categoryUpdateFailed')),
      ),
    onSuccess: invalidatePosts,
  })

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: async () => {
      toast.success(t('posts.toast.deleted'))
      await invalidatePosts()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deletePost(id)))
      const successfulIds = ids.filter(
        (_, index) => results[index].status === 'fulfilled',
      )

      return {
        failedCount: ids.length - successfulIds.length,
        successfulIds,
        successCount: successfulIds.length,
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('posts.toast.batchDeleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      selectionClearRef.current?.()
      if (failedCount > 0) {
        toast.warning(
          t('posts.toast.batchDeletePartial', {
            failed: failedCount,
            success: successCount,
          }),
        )
      } else {
        toast.success(
          t('posts.toast.batchDeleteSucceeded', { count: successCount }),
        )
      }
      await invalidatePosts()
    },
  })

  const pinMutation = useMutation({
    mutationFn: (payload: { id: string; isPinned: boolean }) =>
      patchPost(payload.id, {
        pinAt: payload.isPinned ? new Date().toISOString() : null,
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('posts.toast.pinFailed'))),
    onSuccess: invalidatePosts,
  })

  const externalHrefFor = (post: PostModel) =>
    `${WEB_URL}/posts/${post.category?.slug ?? post.categoryId}/${post.slug}`

  const confirmAndDelete = async (targets: PostModel[]) => {
    if (targets.length === 0) return
    const title =
      targets.length === 1
        ? t('posts.confirmDelete.single', {
            title: targets[0].title || t('posts.row.untitled'),
          })
        : t('posts.confirmDelete.batch', { count: targets.length })
    const confirmed = await confirmDialog({
      destructive: true,
      title,
    })
    if (!confirmed) return
    if (targets.length === 1) {
      deleteMutation.mutate(targets[0].id)
    } else {
      batchDeleteMutation.mutate(targets.map((target) => target.id))
    }
  }

  const actions = useMemo(
    () =>
      buildPostActions(
        {
          deleteMany: confirmAndDelete,
          navigateToEdit: (post) => {
            window.location.hash = `#/posts/edit?id=${encodeURIComponent(post.id)}`
          },
          openExternal: (post) => {
            window.open(externalHrefFor(post), '_blank', 'noopener,noreferrer')
          },
        },
        t,
      ),
    [t],
  )

  const { selection } = useListKeyboard<PostModel>({
    actions,
    getId: (post) => post.id,
    items: posts,
    resetOn: [categoryId, keyword, page, sortKey, sortOrder],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const count = useMemo(() => {
    if (!pagination) return null
    return t('posts.list.count', { count: pagination.total })
  }, [pagination, t])

  const sortOptions = useMemo(
    () =>
      postSortOptionDefinitions.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )

  const categoryOptions = useMemo(
    () => [
      { label: t('posts.filter.allCategories'), value: allCategoriesValue },
      ...(categoriesQuery.data ?? []).map((category) => ({
        label: category.name,
        value: category.id,
      })),
    ],
    [categoriesQuery.data, t],
  )

  const rowCategoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((category) => ({
        id: category.id,
        name: category.name,
      })),
    [categoriesQuery.data],
  )

  const selectedCount = selection.size
  const visibleIds = posts.map((post) => post.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const toggleAllVisible = (checked: boolean) => {
    if (checked) selection.selectAll()
    else selection.clear()
  }

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950"
      id={FOCUS_SCOPE_ID}
    >
      <ContentListHeader
        action={
          <ButtonLink to="/posts/edit">
            <Plus aria-hidden="true" className="size-4" />
            {t('posts.action.newPost')}
          </ButtonLink>
        }
        count={count}
        icon={<FileText aria-hidden="true" className="size-4" />}
        title={t('posts.title')}
      />

      <ContentListToolbar
        extraActions={
          <button
            aria-label={t('posts.list.refreshAria')}
            className="outline-hidden inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            disabled={postsQuery.isFetching}
            onClick={() => void postsQuery.refetch()}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-3.5',
                postsQuery.isFetching && 'animate-spin',
              )}
            />
          </button>
        }
        filters={
          <SelectField
            aria-label={t('posts.filter.byCategoryAria')}
            disabled={Boolean(keyword)}
            onValueChange={(value) => {
              setCategoryId(value)
              setPage(1)
            }}
            options={categoryOptions}
            triggerClassName="w-32 !h-7 !border-transparent !bg-transparent text-xs hover:!bg-neutral-100 dark:hover:!bg-neutral-900"
            value={categoryId}
          />
        }
        sortMenu={
          <SortMenu<PostSortKey>
            disabled={Boolean(keyword)}
            field={sortKey}
            onChange={({ field, order }) => {
              setSortKey(field)
              setSortOrder(order)
              setPage(1)
            }}
            options={sortOptions}
            order={sortOrder}
          />
        }
        hasSearch={Boolean(keyword)}
        onClearSearch={() => {
          setKeywordInput('')
          setKeyword('')
          setPage(1)
        }}
        onSearch={onSearch}
        onSearchValueChange={setKeywordInput}
        searchPlaceholder={t('posts.list.searchPlaceholder')}
        searchValue={keywordInput}
        selection={{
          allVisibleSelected,
          bulkActionDisabled:
            selectedCount === 0 || batchDeleteMutation.isPending,
          bulkActionIcon: <Trash2 aria-hidden="true" className="size-4" />,
          bulkActionLabel: t('posts.action.bulkDelete'),
          hasVisibleItems: posts.length > 0,
          indeterminate: selectedCount > 0 && !allVisibleSelected,
          onBulkAction: () => {
            void confirmAndDelete(selection.getSelectedTargets())
          },
          onToggleAllVisible: toggleAllVisible,
          selectAllLabel: t('posts.list.selectAllVisible'),
          selectedCount,
          selectedLabel: t('posts.list.selectedCount', {
            count: selectedCount,
          }),
        }}
      />

      <Scroll className="min-h-0 flex-1">
        {postsQuery.isLoading && posts.length === 0 ? (
          <PostsSkeleton />
        ) : postsQuery.isError ? (
          <PostsError onRetry={() => void postsQuery.refetch()} />
        ) : posts.length === 0 ? (
          <PostsEmpty keyword={keyword} />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {posts.map((post) => (
              <PostRow
                actions={actions}
                categories={rowCategoryOptions}
                key={post.id}
                onCategoryChange={(id, nextCategoryId) =>
                  categoryMutation.mutate({ categoryId: nextCategoryId, id })
                }
                onPinToggle={(id, isPinned) =>
                  pinMutation.mutate({ id, isPinned })
                }
                onPublishChange={(id, isPublished) =>
                  publishMutation.mutate({ id, isPublished })
                }
                onSelect={(id, mode) => {
                  if (mode === 'range') selection.selectRange(id)
                  else if (mode === 'toggle') selection.toggleWithAnchor(id)
                  else selection.selectOne(id)
                }}
                onSelectedChange={() => selection.toggleWithAnchor(post.id)}
                post={post}
                selected={selection.isSelected(post.id)}
              />
            ))}
          </div>
        )}
      </Scroll>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('posts.list.pageIndicator', { page: pagination.page })}
          </span>
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={pagination.totalPages}
            pageSize={postsPageSize}
            pageSizes={[postsPageSize]}
          />
        </div>
      ) : null}
    </FocusScope>
  )
}
