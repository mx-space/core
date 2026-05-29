import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { PostModel } from '~/models/post'
import type { ListAction } from '~/ui/list-actions'

export interface PostActionHandlers {
  deleteMany: (posts: PostModel[]) => Promise<void> | void
  navigateToEdit: (post: PostModel) => void
  openExternal: (post: PostModel) => void
}

/**
 * Shortcut-eligible actions for the posts list.
 *
 * Anything with a `shortcut` here is wired into the keyboard dispatcher via
 * `useListShortcuts`; the same array is consumed by `buildPostMenuItems` to
 * render the menu entries with consistent labels + `shortcutLabel` hints.
 */
export function buildPostActions(
  handlers: PostActionHandlers,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): ListAction<PostModel>[] {
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
      label: t('posts.action.openExternal'),
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
