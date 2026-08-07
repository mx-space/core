import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import type { ListAction } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import type { ArticleGroupedConfig } from './types'

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
  const openLabel = t(config.itemOpenLabelKey ?? 'ai.action.edit')

  const keyboardActions = useMemo<ReadonlyArray<ListAction<TItem>>>(
    () => [
      {
        key: 'edit',
        label: openLabel,
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
    [t, openLabel, onEdit, onDelete],
  )

  const buildMenu = (item: TItem): ContextMenuItem[] => {
    const base: ContextMenuItem[] = [
      {
        key: 'edit',
        label: openLabel,
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
