import { Pencil, Trash2 } from 'lucide-react'

import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { DraftCard } from '~/models/draft'
import type { ListAction } from '~/ui/list-actions'

export interface DraftActionHandlers {
  deleteMany: (drafts: DraftCard[]) => Promise<void> | void
  open: (draft: DraftCard) => void
}

/**
 * Shortcut-eligible actions for the drafts list. Same registry feeds the
 * context menu and `useListShortcuts`.
 */
export function buildDraftActions(
  handlers: DraftActionHandlers,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): ListAction<DraftCard>[] {
  return [
    {
      icon: Pencil,
      key: 'open',
      label: t('drafts.detail.edit'),
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
