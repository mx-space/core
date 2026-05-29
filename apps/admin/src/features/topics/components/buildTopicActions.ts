import { Pencil, Trash2 } from 'lucide-react'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { TopicModel } from '~/models/topic'
import type { ListAction } from '~/ui/list-actions'

export interface TopicActionHandlers {
  deleteMany: (topics: TopicModel[]) => Promise<void> | void
  open: (topic: TopicModel) => void
}

export function buildTopicActions(
  handlers: TopicActionHandlers,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): ListAction<TopicModel>[] {
  return [
    {
      icon: Pencil,
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
