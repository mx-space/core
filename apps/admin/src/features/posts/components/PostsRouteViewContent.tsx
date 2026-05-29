import { FileText, Plus, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useRef } from 'react'

import { WEB_URL } from '~/constants/env'
import {
  ContentListHeader,
  ContentListRefreshButton,
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

import {
  allCategoriesValue,
  postSortOptionDefinitions,
  postsPageSize,
} from '../constants'
import { usePostMutations } from '../hooks/use-post-mutations'
import { usePostsList } from '../hooks/use-posts-list'
import type { PostSortKey } from '../types/posts'
import { buildPostActions } from './buildPostActions'
import { PostRow } from './PostRow'
import { PostsEmpty } from './PostsEmpty'
import { PostsError } from './PostsError'
import { PostsSkeleton } from './PostsSkeleton'

const FOCUS_SCOPE_ID = 'posts-list'

export function PostsRouteViewContent() {
  const { t } = useI18n()
  const list = usePostsList()
  const {
    categories,
    categoryId,
    keyword,
    keywordInput,
    page,
    pagination,
    posts,
    postsQuery,
    setCategoryId,
    setKeywordInput,
    setPage,
    setSort,
    sortKey,
    sortOrder,
    submitSearch,
  } = list

  // selection is created by useListKeyboard below, after `actions` is built.
  // mutations that fire `selection.clear()` go through this ref to avoid TDZ.
  const selectionClearRef = useRef<(() => void) | null>(null)

  const {
    batchDeleteMutation,
    categoryMutation,
    deleteMutation,
    pinMutation,
    publishMutation,
  } = usePostMutations({
    onBatchSuccess: () => selectionClearRef.current?.(),
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
      ...categories.map((category) => ({
        label: category.name,
        value: category.id,
      })),
    ],
    [categories, t],
  )

  const rowCategoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name,
      })),
    [categories],
  )

  const selectedCount = selection.size
  const visibleIds = posts.map((post) => post.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitSearch()
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
          <ContentListRefreshButton
            isFetching={postsQuery.isFetching}
            label={t('posts.list.refreshAria')}
            onRefresh={() => void postsQuery.refetch()}
          />
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
            onChange={setSort}
            options={sortOptions}
            order={sortOrder}
          />
        }
        hasSearch={Boolean(keyword)}
        onClearSearch={list.clearSearch}
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
