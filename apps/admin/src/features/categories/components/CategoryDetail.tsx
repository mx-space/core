import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useMemo } from 'react'
import { Edit3, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import type { CategoryModel } from '~/models/category'

import { getPosts } from '~/api/posts'
import { usePostResourceList } from '~/data/post-category-resource/hooks'
import {
  serializeResourceListKey,
  usePostCategoryResourceStore,
} from '~/data/post-category-resource/store'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { categoryDetailPostPageSize } from '../constants'
import { DetailHeader } from './DetailHeader'
import { EntitySummary } from './EntitySummary'
import { PostListSection } from './PostListSection'

export function CategoryDetail(props: {
  category: CategoryModel
  deleting: boolean
  onBack: () => void
  onDelete: (category: CategoryModel) => void
  onEdit: (category: CategoryModel) => void
}) {
  const { t } = useI18n()
  const postsQueryKey = useMemo(
    () => adminQueryKeys.posts.categoryDetail(props.category.id),
    [props.category.id],
  )
  const postListResource = usePostResourceList(postsQueryKey)
  const postsQuery = useQuery({
    enabled: !!props.category.id,
    queryFn: () =>
      getPosts({
        categoryIds: [props.category.id],
        page: 1,
        size: categoryDetailPostPageSize,
        sort_by: 'createdAt',
        sort_order: 'desc',
      }),
    queryKey: postsQueryKey,
  })

  useLayoutEffect(() => {
    if (!postsQuery.data) return
    usePostCategoryResourceStore
      .getState()
      .hydratePostList(serializeResourceListKey(postsQueryKey), postsQuery.data)
  }, [postsQuery.data, postsQueryKey])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader onBack={props.onBack} title={t('categories.detail.title')}>
        <Button
          onClick={() => props.onEdit(props.category)}
          type="button"
          variant="subtle"
        >
          <Edit3 aria-hidden="true" className="size-4" />
          {t('common.edit')}
        </Button>
        <Button
          className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={props.deleting}
          onClick={() => props.onDelete(props.category)}
          type="button"
          variant="subtle"
        >
          {props.deleting ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
          {t('common.delete')}
        </Button>
      </DetailHeader>

      <Scroll className="min-h-0 flex-1" innerClassName="p-5">
        <EntitySummary
          countLabel={t('categories.detail.postCount', {
            count: props.category.count,
          })}
          icon={<FolderOpen aria-hidden="true" className="size-6" />}
          meta={props.category.slug}
          title={props.category.name}
        />
        <PostListSection
          emptyText={t('categories.detail.postsByCategoryEmpty')}
          loading={postsQuery.isLoading}
          posts={postListResource.posts}
          title={t('categories.detail.postsByCategory')}
        />
      </Scroll>
    </div>
  )
}
