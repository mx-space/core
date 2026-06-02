import type { CommentListState, CommentRefType } from '~/api/comments'
import { WEB_URL } from '~/constants/env'
import { translate } from '~/i18n/translate'
import type { CommentModel, CommentTab } from '~/models/comment'
import { CommentState } from '~/models/comment'

import { getCommentFilters } from '../constants'
import type { DeviceInfo } from '../types/comments'

const COMMENT_TABS: ReadonlySet<CommentTab> = new Set([
  'unread',
  'awaiting',
  'whispers',
  'read',
  'junk',
  'all',
])

export function normalizeCommentTab(value: string | null): CommentTab {
  if (value && COMMENT_TABS.has(value as CommentTab)) {
    return value as CommentTab
  }
  return 'unread'
}

/**
 * One-time migration for legacy `?state=0|1|2` URLs that pre-date the tabbed
 * IA. Returns the new tab if a legacy state is present; otherwise null.
 */
export function legacyStateToTab(value: string | null): CommentTab | null {
  if (value === null) return null
  if (value === 'all') return 'all'
  switch (value) {
    case '0': {
      return 'unread'
    }
    case '1': {
      return 'read'
    }
    case '2': {
      return 'junk'
    }
    default: {
      return null
    }
  }
}

export function tabToLegacyState(tab: CommentTab): CommentListState {
  switch (tab) {
    case 'unread': {
      return CommentState.Unread
    }
    case 'read': {
      return CommentState.Read
    }
    case 'junk': {
      return CommentState.Junk
    }
    default: {
      return 'all'
    }
  }
}

export function getReferenceLink(comment: CommentModel) {
  const ref = comment.ref
  if (!ref) return ''

  switch (comment.refType) {
    case 'post': {
      return ref.category?.slug && ref.slug
        ? `${WEB_URL}/posts/${ref.category.slug}/${ref.slug}`
        : ''
    }
    case 'note': {
      return ref.nid ? `${WEB_URL}/notes/${ref.nid}` : ''
    }
    case 'page': {
      return ref.slug ? `${WEB_URL}/${ref.slug}` : ''
    }
    case 'recently': {
      return ref.id ? `${WEB_URL}/thinking/${ref.id}` : ''
    }
    default: {
      return ''
    }
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

export function normalizeCommentState(value: string | null): CommentListState {
  if (!value || value === 'all') return 'all'
  const numeric = Number(value)
  return getCommentFilters().some((filter) => filter.value === numeric)
    ? (numeric as CommentState)
    : 'all'
}

export function normalizeCommentRefType(
  value: string | null,
): CommentRefType | undefined {
  if (
    value === 'post' ||
    value === 'note' ||
    value === 'page' ||
    value === 'recently'
  ) {
    return value
  }
  return undefined
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
