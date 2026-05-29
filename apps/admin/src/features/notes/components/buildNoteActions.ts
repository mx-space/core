import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { NoteModel } from '~/models/note'
import type { ListAction } from '~/ui/list-actions'

export interface NoteActionHandlers {
  deleteMany: (notes: NoteModel[]) => Promise<void> | void
  navigateToEdit: (note: NoteModel) => void
  openExternal: (note: NoteModel) => void
}

export function buildNoteActions(
  handlers: NoteActionHandlers,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): ListAction<NoteModel>[] {
  return [
    {
      icon: Pencil,
      key: 'edit',
      label: t('common.edit'),
      run: (targets) => handlers.navigateToEdit(targets[0]),
      shortcut: 'Enter',
      shortcutLabel: '↵',
    },
    {
      icon: ExternalLink,
      key: 'open-external',
      label: t('notes.action.openExternal'),
      run: (targets) => handlers.openExternal(targets[0]),
      shortcut: '$mod+Enter',
      shortcutLabel: '⌘↵',
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
