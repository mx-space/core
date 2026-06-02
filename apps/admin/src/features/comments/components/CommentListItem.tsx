import { CheckCheck, ShieldAlert, Trash2 } from 'lucide-react'

import type { CommentListState } from '~/api/comments'
import { useI18n } from '~/i18n'
import type { CommentModel } from '~/models/comment'
import { CommentState } from '~/models/comment'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import { ListRow } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import { Badge } from '~/ui/primitives/badge'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

import { formatCommentDate, getDeviceInfo } from '../utils/comments'
import { countryFlag } from '../utils/country-flag'
import { Avatar } from './CommentPrimitives'
import type { CommentDensity } from './TopBar'

const FALLBACK_FLAG = '🏳️'

const PARENT_QUOTE_LIMIT = 30

export interface CommentListItemProps {
  actions: ReadonlyArray<ListAction<CommentModel>>
  checked: boolean
  comment: CommentModel
  currentFilter: CommentListState
  cursor?: boolean
  densityMode?: CommentDensity
  isDetailTarget: boolean
  onCheck: (id: string, checked: boolean) => void
  onMarkJunk: (id: string) => void
  onMarkRead: (id: string) => void
  onSelect: (mode: ListRowSelectMode) => void
  onSourceFilter?: (comment: CommentModel) => void
  ownerName?: string
  selected: boolean
}

interface DensityRules {
  identityLine: boolean
  parentQuote: boolean
  bodyClamp: 1 | 2
  ipValue: boolean
  uaSummary: boolean
  threadCount: boolean
}

function rulesForDensity(mode: CommentDensity): DensityRules {
  switch (mode) {
    case 'compact': {
      return {
        identityLine: false,
        parentQuote: false,
        bodyClamp: 1,
        ipValue: false,
        uaSummary: false,
        threadCount: false,
      }
    }
    case 'cozy': {
      return {
        identityLine: false,
        parentQuote: true,
        bodyClamp: 2,
        ipValue: false,
        uaSummary: false,
        threadCount: true,
      }
    }
    default: {
      return {
        identityLine: true,
        parentQuote: true,
        bodyClamp: 2,
        ipValue: true,
        uaSummary: true,
        threadCount: true,
      }
    }
  }
}

function resolveIdentity(comment: CommentModel, anonymousLabel: string) {
  if (comment.mail) return comment.mail
  if (comment.url) return comment.url
  return anonymousLabel
}

function clampPreview(text: string) {
  const trimmed = text.trim()
  if (trimmed.length <= PARENT_QUOTE_LIMIT) return trimmed
  return `${trimmed.slice(0, PARENT_QUOTE_LIMIT)}…`
}

export function CommentListItem(props: CommentListItemProps) {
  const { format, t } = useI18n()
  const density: CommentDensity = props.densityMode ?? 'rich'
  const rules = rulesForDensity(density)
  const commentText = props.comment.isDeleted
    ? t('comments.deletedPlaceholder')
    : props.comment.text

  const identity = resolveIdentity(props.comment, t('comments.anonymous'))
  const parentPreview = props.comment.parent
  const showParentQuote =
    rules.parentQuote && parentPreview && !parentPreview.isDeleted
  const showJunkBadge = props.currentFilter === CommentState.Junk
  const showOwnerReplyBadge =
    Boolean(props.ownerName) &&
    Boolean(parentPreview?.author) &&
    parentPreview?.author === props.ownerName
  const isUnread = props.comment.state === CommentState.Unread

  const device = rules.uaSummary ? getDeviceInfo(props.comment.agent) : null
  const threadCount = props.comment.replyCount ?? 0
  const flagGlyph = countryFlag(props.comment.countryCode)
  const showFlagFallback = flagGlyph === FALLBACK_FLAG

  const menuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []
    if (props.currentFilter !== CommentState.Read) {
      items.push({
        icon: CheckCheck,
        key: 'mark-read',
        label: t('comments.action.markRead'),
        onClick: () => props.onMarkRead(props.comment.id),
      })
    }
    if (props.currentFilter !== CommentState.Junk) {
      items.push({
        icon: ShieldAlert,
        key: 'mark-junk',
        label: t('comments.action.markJunk'),
        onClick: () => props.onMarkJunk(props.comment.id),
      })
    }
    if (items.length > 0) items.push({ key: 'sep-1', type: 'divider' })
    items.push({
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: t('common.delete'),
      onClick: () =>
        props.actions.find((a) => a.key === 'delete')?.run([props.comment]),
    })
    return items
  }

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group relative grid cursor-default grid-cols-[auto_auto_minmax(0,1fr)] gap-3 border-b border-border px-4 py-3 pl-6 last:border-b-0',
        'hover:bg-surface-inset',
        'data-popup-open:bg-surface-inset',
        'data-selected:bg-accent-soft data-selected:text-fg',
        'data-selected:hover:bg-accent-soft',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40',
      )}
      cursor={props.cursor}
      dataId={props.comment.id}
      leading={
        <Checkbox
          aria-label={t('comments.list.selectComment')}
          checked={props.checked}
          className="mt-1"
          cursor={props.cursor}
          onCheckedChange={(checked) =>
            props.onCheck(props.comment.id, checked)
          }
        />
      }
      menuItems={menuItems}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      {isUnread ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-6 size-1.5 -translate-y-1/2 rounded-full bg-accent"
          data-testid="comments-row-unread-dot"
        />
      ) : null}
      <Avatar comment={props.comment} size="sm" />
      <div
        className="min-w-0 flex-1"
        data-density={density}
        data-testid={`comments-row-${props.comment.id}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-fg">
            {props.comment.author || t('comments.anonymous')}
          </span>

          {rules.identityLine ? (
            <span
              className="truncate text-xs text-fg-subtle"
              data-testid="comments-row-identity"
            >
              {identity}
            </span>
          ) : null}

          {props.comment.editedAt ? (
            <Badge
              data-testid="comments-row-badge-edited"
              pill
              size="sm"
              tone="neutral"
              variant="soft"
            >
              {t('comments.badge.edited')}
            </Badge>
          ) : null}
          {props.comment.isWhispers ? (
            <Badge
              data-testid="comments-row-badge-whispers"
              pill
              size="sm"
              tone="warning"
              variant="soft"
            >
              {t('comments.badge.whispers')}
            </Badge>
          ) : null}
          {showJunkBadge ? (
            <Badge
              data-testid="comments-row-badge-junk"
              pill
              size="sm"
              tone="danger"
              variant="soft"
            >
              {t('comments.badge.junkAutoFlagged')}
            </Badge>
          ) : null}
          {props.comment.pin ? (
            <Badge
              data-testid="comments-row-badge-pinned"
              pill
              size="sm"
              tone="success"
              variant="soft"
            >
              {t('comments.badge.pinned')}
            </Badge>
          ) : null}
          {showOwnerReplyBadge ? (
            <Badge
              data-testid="comments-row-badge-owner"
              pill
              size="sm"
              tone="accent"
              variant="soft"
            >
              {t('comments.badge.replyingToOwner', {
                owner: props.ownerName ?? '',
              })}
            </Badge>
          ) : null}

          <time
            className="ml-auto shrink-0 text-xs text-fg-subtle"
            dateTime={props.comment.createdAt}
          >
            {formatCommentDate(props.comment.createdAt)}
          </time>
        </div>

        {showParentQuote && parentPreview ? (
          <p
            className="mt-1 truncate text-xs text-fg-muted"
            data-testid="comments-row-parent-quote"
          >
            <span className="font-medium text-fg">
              {parentPreview.author ?? t('comments.anonymous')}:
            </span>{' '}
            <span className="text-fg-subtle">
              {clampPreview(parentPreview.text)}
            </span>
          </p>
        ) : null}

        <p
          className={cn(
            'mt-1 whitespace-pre-wrap text-sm text-fg-muted',
            rules.bodyClamp === 1 ? 'line-clamp-1' : 'line-clamp-2',
          )}
          data-testid="comments-row-body"
        >
          {commentText}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {props.comment.ref?.title ? (
            <button
              className="max-w-[14rem] truncate text-left hover:text-accent hover:underline focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
              data-testid="comments-row-source"
              onClick={(event) => {
                event.stopPropagation()
                props.onSourceFilter?.(props.comment)
              }}
              type="button"
            >
              {props.comment.ref.title}
            </button>
          ) : null}

          <span
            aria-hidden={showFlagFallback ? 'true' : undefined}
            className={cn(
              'inline-flex items-center gap-1',
              showFlagFallback && 'text-fg-subtle',
            )}
            data-testid="comments-row-country"
          >
            <span>{flagGlyph}</span>
            {rules.ipValue && props.comment.ip ? (
              <span data-testid="comments-row-ip">{props.comment.ip}</span>
            ) : null}
          </span>

          {device ? (
            <span data-testid="comments-row-ua">{device.label}</span>
          ) : null}

          {rules.threadCount && threadCount > 0 ? (
            <span data-testid="comments-row-thread">
              {t('comments.list.threadCount', {
                count: format.number(threadCount),
              })}
            </span>
          ) : null}
        </div>
      </div>
    </ListRow>
  )
}
