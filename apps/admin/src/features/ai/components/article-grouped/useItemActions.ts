import { useMemo } from 'react'
import type { ListAction } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import type { ArticleGroupedConfig } from './types'

import { useI18n } from '~/i18n'

interface UseItemActionsOptions<TItem> {
  config: ArticleGroupedConfig<TItem>
  onEdit: (item: TItem) => void
  onDelete: (item: TItem) => void
  onExtraAction: (item: TItem, run: (item: TItem) => Promise<unknown>) => void
}

interface UseItemActionsAPI<TItem> {
  keyboardActions: ReadonlyArray<ListAction<TItem>>
  buildMenu: (item: TItem) => ContextMenuItem[]
}

export function useItemActions<TItem>(
  options: UseItemActionsOptions<TItem>,
): UseItemActionsAPI<TItem> {
  const { t } = useI18n()
  const { config, onEdit, onDelete, onExtraAction } = options

  const keyboardActions = useMemo<ReadonlyArray<ListAction<TItem>>>(
    () => [
      {
        key: 'edit',
        label: t('ai.action.edit'),
        shortcut: 'Enter',
        run: (targets) => {
          const target = targets[0]
          if (target) onEdit(target)
        },
      },
      {
        key: 'delete',
        label: t('ai.action.delete'),
        shortcut: 'Backspace',
        danger: true,
        run: (targets) => {
          const target = targets[0]
          if (target) onDelete(target)
        },
      },
    ],
    [t, onEdit, onDelete],
  )

  const buildMenu = (item: TItem): ContextMenuItem[] => {
    const base: ContextMenuItem[] = [
      {
        key: 'edit',
        label: t('ai.action.edit'),
        onClick: () => onEdit(item),
      },
      {
        key: 'delete',
        label: t('ai.action.delete'),
        danger: true,
        onClick: () => onDelete(item),
      },
    ]
    const extras = (config.extraItemActions?.(item) ?? []).map<ContextMenuItem>(
      (action) => ({
        key: action.id,
        label: t(action.labelKey),
        danger: action.destructive,
        icon: action.icon,
        onClick: () => onExtraAction(item, action.run),
      }),
    )
    return [...base, ...extras]
  }

  return { keyboardActions, buildMenu }
}
