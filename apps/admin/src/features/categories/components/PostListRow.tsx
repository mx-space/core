import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router'

import { WEB_URL } from '~/constants/env'
import { usePostResourcePost } from '~/data/post-category-resource/hooks'
import { useI18n } from '~/i18n'
import { relativeTimeFromNow } from '~/utils/time'

export function PostListRow(props: { postId: string }) {
  const { t } = useI18n()
  const post = usePostResourcePost(props.postId)

  if (!post) return null

  const externalHref = `${WEB_URL}/posts/${post.category?.slug ?? post.categoryId}/${post.slug}`

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800">
      <Link
        className="min-w-0 flex-1"
        title={t('categories.postRow.editTitle')}
        to={`/posts/edit?id=${post.id}`}
      >
        <p className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {post.title || t('categories.postRow.unnamed')}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <time dateTime={post.createdAt}>
            {relativeTimeFromNow(post.createdAt)}
          </time>
          <span>
            {t('categories.postRow.readSuffix', {
              count: post.readCount ?? 0,
            })}
          </span>
        </div>
      </Link>
      <a
        className="inline-flex size-8 shrink-0 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        href={externalHref}
        rel="noreferrer"
        target="_blank"
        title={t('categories.postRow.openTitle')}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
      </a>
    </div>
  )
}
