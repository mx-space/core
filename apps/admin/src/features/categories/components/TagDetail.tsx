import { useQuery } from '@tanstack/react-query'
import { Tag } from 'lucide-react'
import type { TagModel } from '~/models/category'

import { getPostsByTag } from '~/api/categories'
import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { DetailHeader } from './DetailHeader'
import { EntitySummary } from './EntitySummary'
import { PostListSection } from './PostListSection'

export function TagDetail(props: { onBack: () => void; tag: TagModel }) {
  const { t } = useI18n()
  const postsQuery = useQuery({
    enabled: !!props.tag.name,
    queryFn: () => getPostsByTag(props.tag.name),
    queryKey: ['posts', 'tag-detail', props.tag.name],
  })

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
          posts={postsQuery.data ?? []}
          title={t('categories.detail.postsByTagTitle', {
            name: props.tag.name,
          })}
        />
      </Scroll>
    </div>
  )
}
