import { BookOpen, Pin, ThumbsUp } from 'lucide-react'

import { WEB_URL } from '~/constants/env'
import {
  ContentEntryListItem,
  ContentListStatusBadge,
} from '~/features/_shared/components/content-list-item'
import { useI18n } from '~/i18n'
import type { PostModel } from '~/models/post'
import type { ListAction } from '~/ui/list-actions'
import { Badge } from '~/ui/primitives/badge'
import { relativeTimeFromNow } from '~/utils/time'

import { buildPostMenuItems } from './buildPostMenuItems'

export interface PostMenuCategoryOption {
  id: string
  name: string
}

export function PostRow(props: {
  actions: ReadonlyArray<ListAction<PostModel>>
  categories: PostMenuCategoryOption[]
  cursor?: boolean
  onCategoryChange: (id: string, categoryId: string) => void
  onPinToggle: (id: string, isPinned: boolean) => void
  onPublishChange: (id: string, isPublished: boolean) => void
  onSelect: (id: string, mode: 'single' | 'toggle' | 'range') => void
  onSelectedChange: (checked: boolean) => void
  post: PostModel
  selected: boolean
}) {
  const { t } = useI18n()
  const post = props.post
  const externalHref = `${WEB_URL}/posts/${post.category?.slug ?? post.categoryId}/${post.slug}`
  const isPublished = post.isPublished ?? false
  const title = post.title || t('posts.row.untitled')
  const editPath = `/posts/edit?id=${encodeURIComponent(post.id)}`

  const menuItems = () =>
    buildPostMenuItems(post, {
      actions: props.actions,
      categories: props.categories,
      externalHref,
      onCategoryChange: (categoryId) =>
        props.onCategoryChange(post.id, categoryId),
      onPinToggle: (next) => props.onPinToggle(post.id, next),
      onPublishToggle: (next) => props.onPublishChange(post.id, next),
      t,
    })

  return (
    <ContentEntryListItem
      checkboxLabel={t('posts.list.checkboxAria', { title })}
      cursor={props.cursor}
      dataId={post.id}
      editTitle={t('posts.action.editPost')}
      editTo={editPath}
      externalHref={externalHref}
      leading={
        post.pinAt ? (
          <Pin aria-hidden="true" className="size-3.5 text-orange-500" />
        ) : null
      }
      menuItems={menuItems}
      meta={
        <>
          <Badge size="sm" variant="soft">
            {post.category?.name ?? t('posts.meta.uncategorized')}
          </Badge>
          {post.tags?.length ? (
            <span className="max-w-64 truncate">{post.tags.join('、')}</span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <BookOpen aria-hidden="true" className="size-3" />
            {post.readCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp aria-hidden="true" className="size-3" />
            {post.likeCount ?? 0}
          </span>
        </>
      }
      onSelect={(mode) => props.onSelect(post.id, mode)}
      onSelectedChange={props.onSelectedChange}
      openTitle={t('posts.action.openPost')}
      selected={props.selected}
      status={
        <ContentListStatusBadge active={isPublished}>
          {isPublished ? t('posts.status.published') : t('posts.status.draft')}
        </ContentListStatusBadge>
      }
      title={title}
      titleTo={editPath}
      trailingFooter={
        <time dateTime={post.createdAt}>
          {relativeTimeFromNow(post.createdAt)}
        </time>
      }
    />
  )
}
