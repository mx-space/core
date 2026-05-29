import { CheckCheck, ShieldAlert, Trash2 } from 'lucide-react'
import type { CommentModel } from '~/models/comment'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import { useI18n } from '~/i18n'
import { CommentState } from '~/models/comment'
import { ListRow } from '~/ui/list-actions'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

import { formatCommentDate } from '../utils/comments'
import { Avatar } from './CommentPrimitives'

export function CommentListItem(props: {
  actions: ReadonlyArray<ListAction<CommentModel>>
  checked: boolean
  comment: CommentModel
  currentFilter: CommentState
  isDetailTarget: boolean
  onCheck: (id: string, checked: boolean) => void
  onMarkJunk: (id: string) => void
  onMarkRead: (id: string) => void
  onSelect: (mode: ListRowSelectMode) => void
  selected: boolean
}) {
  const { t } = useI18n()
  const commentText = props.comment.isDeleted
    ? t('comments.deletedPlaceholder')
    : props.comment.text

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
        'group grid cursor-default grid-cols-[auto_auto_minmax(0,1fr)] gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-900',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/40',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-900',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={props.comment.id}
      leading={
        <Checkbox
          aria-label={t('comments.list.selectComment')}
          checked={props.checked}
          className="mt-1"
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
      <Avatar comment={props.comment} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {props.comment.author || t('comments.anonymous')}
          </span>
          {props.comment.parentCommentId ? (
            <span className="text-xs text-neutral-400">
              {t('comments.list.replyMark')}
            </span>
          ) : null}
          <time
            className="ml-auto shrink-0 text-xs text-neutral-400"
            dateTime={props.comment.createdAt}
          >
            {formatCommentDate(props.comment.createdAt)}
          </time>
        </div>
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-400">
          {commentText}
        </p>
        {props.comment.isWhispers ? (
          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            {t('comments.whispers')}
          </span>
        ) : null}
      </div>
    </ListRow>
  )
}
