import { translate } from '~/i18n/translate'
import { CommentState } from '~/models/comment'

export const commentsQueryKey = ['comments']
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
  value: CommentState
}[] {
  return [
    { label: translate('comments.filter.unread'), value: CommentState.Unread },
    { label: translate('comments.filter.read'), value: CommentState.Read },
    { label: translate('comments.filter.junk'), value: CommentState.Junk },
  ]
}
