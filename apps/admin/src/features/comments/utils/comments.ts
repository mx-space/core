import type { CommentModel } from '~/models/comment'
import type { DeviceInfo } from '../types/comments'

import { WEB_URL } from '~/constants/env'
import { translate } from '~/i18n/translate'
import { CommentState } from '~/models/comment'

import { getCommentFilters } from '../constants'

export function getReferenceLink(comment: CommentModel) {
  const ref = comment.ref
  if (!ref) return ''

  switch (comment.refType) {
    case 'post':
      return ref.category?.slug && ref.slug
        ? `${WEB_URL}/posts/${ref.category.slug}/${ref.slug}`
        : ''
    case 'note':
      return ref.nid ? `${WEB_URL}/notes/${ref.nid}` : ''
    case 'page':
      return ref.slug ? `${WEB_URL}/${ref.slug}` : ''
    case 'recently':
      return ref.id ? `${WEB_URL}/thinking/${ref.id}` : ''
    default:
      return ''
  }
}

export function getDeviceInfo(agent?: string): DeviceInfo {
  const value = agent?.toLowerCase() ?? ''
  return {
    isMobile:
      value.includes('mobile') ||
      value.includes('android') ||
      value.includes('iphone'),
    label: agent?.split(' ')[0] || translate('comments.meta.unknownDevice'),
  }
}

export function normalizeCommentState(value: string | null): CommentState {
  const numeric = Number(value)
  return getCommentFilters().some((filter) => filter.value === numeric)
    ? (numeric as CommentState)
    : CommentState.Unread
}

export function readCommentPage(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function formatCommentDate(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
