import { Trash2 } from 'lucide-react'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { CommentModel } from '~/models/comment'
import type { ListAction } from '~/ui/list-actions'

export interface CommentActionHandlers {
  deleteMany: (comments: CommentModel[]) => Promise<void> | void
  open: (comment: CommentModel) => void
}

/**
 * Shortcut-eligible actions for the comments list. `mark-read`/`mark-junk`
 * stay menu-only (built per-row in CommentListItem) since the registry can't
 * easily express filter-state-conditional visibility.
 */
export function buildCommentActions(
  handlers: CommentActionHandlers,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): ListAction<CommentModel>[] {
  return [
    {
      key: 'open',
      label: t('common.view'),
      run: (targets) => handlers.open(targets[0]),
      shortcut: 'Enter',
      shortcutLabel: '↵',
    },
    {
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: t('common.delete'),
      multi: true,
      run: (targets) => handlers.deleteMany(targets),
      shortcut: 'Backspace',
      shortcutLabel: '⌫',
    },
  ]
}
