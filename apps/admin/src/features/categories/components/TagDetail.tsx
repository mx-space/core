import { useQuery } from '@tanstack/react-query'
import { Tag } from 'lucide-react'
import { useLayoutEffect, useMemo } from 'react'
import type { TagModel } from '~/models/category'

import { getPostsByTag } from '~/api/categories'
import {
  serializeResourceListKey,
  usePostCategoryResourceStore,
} from '~/data/post-category-resource/store'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Scroll } from '~/ui/primitives/scroll'

import { DetailHeader } from './DetailHeader'
import { EntitySummary } from './EntitySummary'
import { PostListSection } from './PostListSection'

export function TagDetail(props: { onBack: () => void; tag: TagModel }) {
  const { t } = useI18n()
  const postsQueryKey = useMemo(
    () => adminQueryKeys.posts.tagDetail(props.tag.name),
    [props.tag.name],
  )
  const postsQuery = useQuery({
    enabled: !!props.tag.name,
    queryFn: () => getPostsByTag(props.tag.name),
    queryKey: postsQueryKey,
  })

  useLayoutEffect(() => {
    if (!postsQuery.data) return
    usePostCategoryResourceStore.getState().hydratePostList(
      serializeResourceListKey(postsQueryKey),
      {
        data: postsQuery.data,
        pagination: {
          page: 1,
          size: postsQuery.data.length,
          total: postsQuery.data.length,
          totalPages: 1,
        },
      },
    )
  }, [postsQuery.data, postsQueryKey])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        onBack={props.onBack}
        title={t('categories.detail.tagTitle')}
      />
      <Scroll className="min-h-0 flex-1" innerClassName="p-5">
        <EntitySummary
          countLabel={t('categories.detail.postCount', {
            count: props.tag.count,
          })}
          icon={<Tag aria-hidden="true" className="size-6" />}
          title={props.tag.name}
        />
        <PostListSection
          emptyText={t('categories.detail.postsByTagEmpty')}
          loading={postsQuery.isLoading}
          queryKey={postsQueryKey}
          title={t('categories.detail.postsByTagTitle', {
            name: props.tag.name,
          })}
        />
      </Scroll>
    </div>
  )
}
