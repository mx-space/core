import type { PostModel } from '~/models/post'

import { useI18n } from '~/i18n'

import { PostListRow } from './PostListRow'

export function PostListSection(props: {
  emptyText: string
  loading: boolean
  posts: PostModel[]
  title: string
}) {
  const { t } = useI18n()
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {props.title}
        </h3>
        {!props.loading && props.posts.length > 0 ? (
          <span className="text-xs text-neutral-400">
            {t('categories.section.postsCount', { count: props.posts.length })}
          </span>
        ) : null}
      </div>
      {props.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
              key={index}
            />
          ))}
        </div>
      ) : props.posts.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          {props.emptyText}
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
          {props.posts.map((post) => (
            <PostListRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  )
}
