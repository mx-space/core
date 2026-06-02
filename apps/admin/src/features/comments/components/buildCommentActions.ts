import { CheckCheck, ShieldAlert, Trash2 } from 'lucide-react'

import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { CommentModel } from '~/models/comment'
import { CommentState } from '~/models/comment'
import type { ListAction } from '~/ui/list-actions'

export interface CommentActionHandlers {
  /** Open the comment in the detail pane. */
  open: (comment: CommentModel) => void
  /** Close the detail pane (called by `*-next` when no successor exists). */
  closeDetail: () => void
  /** Return the row that should be focused after the given id is mutated. */
  getNextOf: (id: string) => CommentModel | null
  /** Patch the comment's state (read / junk). */
  markState: (id: string, state: CommentState) => Promise<void> | void
  /** Delete one-or-many comments (used as the single-row destructive action). */
  deleteMany: (comments: CommentModel[]) => Promise<void> | void
}

type TranslateFn = (key: TranslationKey, values?: TranslationValues) => string

/**
 * Comment list actions. The "& next" variants advance to the next row in the
 * current list snapshot so triage runs hands-off the mouse. `getNextOf` is
 * supplied by the orchestrator and reads from the latest list cache.
 */
export function buildCommentActions(
  deps: CommentActionHandlers,
  t: TranslateFn,
): ReadonlyArray<ListAction<CommentModel>> {
  const markAndAdvance =
    (state: CommentState) => async (targets: CommentModel[]) => {
      const [target] = targets
      if (!target) return
      const next = deps.getNextOf(target.id)
      await deps.markState(target.id, state)
      if (next) deps.open(next)
      else deps.closeDetail()
    }

  return [
    {
      icon: CheckCheck,
      key: 'mark-read',
      label: t('comments.action.markRead'),
      run: ([target]) => {
        if (!target) return
        return deps.markState(target.id, CommentState.Read)
      },
      shortcut: 'e',
      shortcutLabel: 'E',
    },
    {
      icon: CheckCheck,
      key: 'mark-read-next',
      label: t('comments.action.markReadNext'),
      run: markAndAdvance(CommentState.Read),
      shortcut: 'Alt+e',
      shortcutLabel: '⌥E',
    },
    {
      icon: ShieldAlert,
      key: 'mark-junk',
      label: t('comments.action.markJunk'),
      run: ([target]) => {
        if (!target) return
        return deps.markState(target.id, CommentState.Junk)
      },
      shortcut: 's',
      shortcutLabel: 'S',
    },
    {
      icon: ShieldAlert,
      key: 'mark-junk-next',
      label: t('comments.action.markJunkNext'),
      run: markAndAdvance(CommentState.Junk),
      shortcut: 'Alt+s',
      shortcutLabel: '⌥S',
    },
    {
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: t('common.delete'),
      multi: true,
      run: (targets) => deps.deleteMany(targets),
      shortcut: 'Backspace',
      shortcutLabel: '⌫',
    },
  ]
}
