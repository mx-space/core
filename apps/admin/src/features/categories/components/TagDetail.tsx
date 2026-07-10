import { Tag } from 'lucide-react'

import { getPostsByTag } from '~/api/categories'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { posts } from '~/data/resources/post'
import { useI18n } from '~/i18n'
import type { TagModel } from '~/models/category'
import { adminQueryKeys } from '~/query/keys'
import { Scroll } from '~/ui/primitives/scroll'

import { DetailHeader } from './DetailHeader'
import { EntitySummary } from './EntitySummary'
import { PostListSection } from './PostListSection'

export function TagDetail(props: { onBack: () => void; tag: TagModel }) {
  const { t } = useI18n()
  const postsListKey = adminQueryKeys.posts.tagDetail(props.tag.name)
  const postsQuery = useCollectionListQuery(posts, {
    enabled: !!props.tag.name,
    queryFn: () => getPostsByTag(props.tag.name),
    queryKey: postsListKey,
    toPage: (result) => ({ items: result }),
  })
  const postsList = useEntityList(posts, postsListKey)

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
          posts={postsList.items}
          title={t('categories.detail.postsByTagTitle', {
            name: props.tag.name,
          })}
        />
      </Scroll>
    </div>
  )
}
