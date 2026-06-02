import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import type { CommentModel, CommentThreadResponse } from '~/models/comment'
import { CommentState } from '~/models/comment'
import { Badge } from '~/ui/primitives/badge'
import { MarkdownRender } from '~/ui/primitives/markdown-render'
import { cn } from '~/utils/cn'

import { formatCommentDate } from '../utils/comments'
import { Avatar } from './CommentPrimitives'

interface ThreadColumnProps {
  thread: CommentThreadResponse | undefined
  comment: CommentModel
  ownerName: string
  /** Optimistic owner-sent replies not yet reflected in the thread response. */
  pendingMessages?: ReadonlyArray<CommentModel>
}

export function ThreadColumn(props: ThreadColumnProps) {
  const { t } = useI18n()
  const messages = useMemo(
    () =>
      orderThread(props.thread?.thread, props.comment, props.pendingMessages),
    [props.thread?.thread, props.comment, props.pendingMessages],
  )

  return (
    <div
      aria-label={t('comments.thread.repliesLabel', {
        count: messages.length,
      })}
      data-testid="comments-thread"
    >
      <h3 className="mb-3 text-xs font-medium text-fg-subtle">
        {t('comments.thread.repliesLabel', { count: messages.length })}
      </h3>
      <ol className="space-y-0">
        {messages.map((entry, index) => (
          <ThreadMessage
            connector={index < messages.length - 1}
            isCurrent={entry.id === props.comment.id}
            key={entry.id}
            message={entry}
            ownerName={props.ownerName}
          />
        ))}
      </ol>
    </div>
  )
}

function ThreadMessage(props: {
  message: CommentModel
  ownerName: string
  isCurrent: boolean
  connector: boolean
}) {
  const { t } = useI18n()
  const { message } = props
  const isOwner =
    Boolean(props.ownerName) && (message.author ?? '') === props.ownerName
  const isJunk = message.state === CommentState.Junk
  const text = message.isDeleted
    ? t('comments.deletedPlaceholder')
    : message.text

  return (
    <li
      className={cn(
        'relative flex gap-3 rounded-md px-3 py-3 -mx-3 transition-colors',
        props.isCurrent ? 'bg-surface-inset' : 'hover:bg-surface-inset/60',
      )}
      data-current={props.isCurrent || undefined}
      data-testid={
        props.isCurrent ? 'comments-thread-current' : 'comments-thread-message'
      }
    >
      <div className="flex shrink-0 flex-col items-center">
        <Avatar comment={message} size="sm" />
        {props.connector ? (
          <div
            aria-hidden="true"
            className="mb-[-12px] mt-1 w-px flex-1 bg-border"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              'truncate text-sm text-fg',
              props.isCurrent ? 'font-bold' : 'font-semibold',
            )}
          >
            {message.author || t('comments.anonymous')}
          </span>
          {isOwner ? (
            <Badge pill size="sm" tone="accent" variant="soft">
              {t('comments.badge.owner')}
            </Badge>
          ) : null}
          {message.editedAt ? (
            <Badge pill size="sm" tone="neutral" variant="soft">
              {t('comments.badge.edited')}
            </Badge>
          ) : null}
          {isJunk ? (
            <Badge pill size="sm" tone="danger" variant="soft">
              {t('comments.filter.junk')}
            </Badge>
          ) : null}
          {props.isCurrent ? (
            <Badge pill size="sm" tone="accent" variant="soft">
              {t('comments.thread.viewing')}
            </Badge>
          ) : null}
          <time
            className="ml-auto text-xs text-fg-subtle"
            dateTime={message.editedAt ?? message.createdAt}
          >
            {formatCommentDate(message.createdAt)}
            {message.editedAt && props.isCurrent ? (
              <span className="ml-1">
                {t('comments.editedSuffix', {
                  time: formatCommentDate(message.editedAt),
                })}
              </span>
            ) : null}
          </time>
        </div>
        {message.isDeleted ? (
          <p
            className={cn(
              'mt-1 whitespace-pre-wrap text-fg-subtle',
              props.isCurrent ? 'text-sm leading-7' : 'text-sm leading-6',
            )}
          >
            {text}
          </p>
        ) : (
          <MarkdownRender
            className={cn(
              'mt-1',
              props.isCurrent
                ? 'text-base leading-7 text-fg'
                : 'text-sm leading-6 text-fg-muted',
            )}
            text={text}
          />
        )}
      </div>
    </li>
  )
}

function orderThread(
  thread: ReadonlyArray<CommentModel> | undefined,
  current: CommentModel,
  pending: ReadonlyArray<CommentModel> | undefined,
): CommentModel[] {
  const list = thread && thread.length > 0 ? [...thread] : [current]
  const seen = new Set<string>()
  const dedup: CommentModel[] = []
  for (const entry of list) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    dedup.push(entry)
  }
  if (!seen.has(current.id)) dedup.push(current)
  if (pending && pending.length > 0) {
    for (const entry of pending) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      dedup.push(entry)
    }
  }
  return dedup.sort((a, b) => {
    const at = new Date(a.createdAt).getTime()
    const bt = new Date(b.createdAt).getTime()
    if (at === bt) return a.id.localeCompare(b.id)
    return at - bt
  })
}
