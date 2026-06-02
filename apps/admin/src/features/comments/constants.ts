import type { CommentListState, CommentRefType } from '~/api/comments'
import { translate } from '~/i18n/translate'
import { CommentState } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

export const commentsQueryKey = adminQueryKeys.comments.root
export const commentsPageSize = 20

export const commentQuickEmojis = [
  '😀',
  '😄',
  '😂',
  '😊',
  '😍',
  '🥳',
  '😢',
  '😭',
  '😅',
  '🤔',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '🔥',
  '✨',
  '❤️',
  '💔',
  '🎉',
  '🌹',
  '🍻',
  '☕',
  '🚀',
]

export function getCommentFilters(): {
  label: string
  value: CommentListState
}[] {
  return [
    { label: translate('comments.filter.all'), value: 'all' },
    { label: translate('comments.filter.unread'), value: CommentState.Unread },
    { label: translate('comments.filter.read'), value: CommentState.Read },
    { label: translate('comments.filter.junk'), value: CommentState.Junk },
  ]
}

export function getCommentRefTypeFilters(): {
  label: string
  value: CommentRefType | 'all'
}[] {
  return [
    { label: translate('comments.filter.allSources'), value: 'all' },
    { label: translate('comments.refType.post'), value: 'post' },
    { label: translate('comments.refType.note'), value: 'note' },
    { label: translate('comments.refType.page'), value: 'page' },
    { label: translate('comments.refType.recently'), value: 'recently' },
  ]
}
