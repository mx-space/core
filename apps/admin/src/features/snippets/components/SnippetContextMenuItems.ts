import {
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  FilePlus,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Link as LinkIcon,
  Pencil,
  Trash2,
} from 'lucide-react'

import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import type { SnippetTreeFolder } from './SnippetList'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export interface BuildFileMenuItemsArgs {
  onCopyPath: () => void
  onCopyRawUrl: () => void
  onDelete: () => void
  onMoveTo: () => void
  onOpen: () => void
  onOpenExternal: () => void
  onRename: () => void
  onRevealInParent: () => void
  snippet: SnippetModel
  t: Translator
}

export function buildFileMenuItems(
  args: BuildFileMenuItemsArgs,
): ContextMenuItem[] {
  const { snippet, t } = args
  const isResetBuiltIn =
    snippet.builtIn && snippet.type === SnippetType.Function
  return [
    {
      icon: FolderOpen,
      key: 'open',
      label: t('snippets.menu.open'),
      onClick: args.onOpen,
    },
    {
      icon: ExternalLink,
      key: 'openExternal',
      label: t('snippets.menu.openExternal'),
      onClick: args.onOpenExternal,
    },
    {
      icon: LinkIcon,
      key: 'copyRawUrl',
      label: t('snippets.menu.copyRawUrl'),
      onClick: args.onCopyRawUrl,
    },
    {
      icon: Copy,
      key: 'copyPath',
      label: t('snippets.menu.copyPath'),
      onClick: args.onCopyPath,
    },
    { key: 'sep-1', type: 'divider' },
    {
      icon: Pencil,
      key: 'rename',
      label: t('snippets.menu.rename'),
      onClick: args.onRename,
    },
    {
      icon: FolderInput,
      key: 'moveTo',
      label: t('snippets.menu.moveTo'),
      onClick: args.onMoveTo,
    },
    {
      icon: FolderOpen,
      key: 'revealInParent',
      label: t('snippets.menu.revealInParent'),
      onClick: args.onRevealInParent,
    },
    { key: 'sep-2', type: 'divider' },
    {
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: isResetBuiltIn
        ? t('snippets.editor.action.reset')
        : t('snippets.menu.delete'),
      onClick: args.onDelete,
    },
  ]
}

export interface BuildMultiSelectFileMenuItemsArgs {
  count: number
  onDelete: () => void
  onMoveTo: () => void
  t: Translator
}

export function buildMultiSelectFileMenuItems(
  args: BuildMultiSelectFileMenuItemsArgs,
): ContextMenuItem[] {
  const { count, t } = args
  return [
    {
      icon: FolderInput,
      key: 'moveTo',
      label: t('snippets.menu.moveToN', { count }),
      onClick: args.onMoveTo,
    },
    { key: 'sep-1', type: 'divider' },
    {
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: t('snippets.menu.deleteN', { count }),
      onClick: args.onDelete,
    },
  ]
}

export interface BuildFolderMenuItemsArgs {
  fileCount: number
  folder: SnippetTreeFolder
  onCollapseAll: () => void
  onCopyPath: () => void
  onDelete: () => void
  onExpandAll: () => void
  onMoveTo: () => void
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  t: Translator
}

export function buildFolderMenuItems(
  args: BuildFolderMenuItemsArgs,
): ContextMenuItem[] {
  const { fileCount, t } = args
  return [
    {
      icon: FilePlus,
      key: 'newFile',
      label: t('snippets.menu.newFile'),
      onClick: args.onNewFile,
    },
    {
      icon: FolderPlus,
      key: 'newFolder',
      label: t('snippets.menu.newFolder'),
      onClick: args.onNewFolder,
    },
    { key: 'sep-1', type: 'divider' },
    {
      icon: Pencil,
      key: 'rename',
      label: t('snippets.menu.rename'),
      onClick: args.onRename,
    },
    {
      icon: FolderInput,
      key: 'moveTo',
      label: t('snippets.menu.moveTo'),
      onClick: args.onMoveTo,
    },
    {
      icon: Copy,
      key: 'copyPath',
      label: t('snippets.menu.copyPath'),
      onClick: args.onCopyPath,
    },
    { key: 'sep-2', type: 'divider' },
    {
      icon: ChevronsUpDown,
      key: 'expandAll',
      label: t('snippets.menu.expandAll'),
      onClick: args.onExpandAll,
    },
    {
      icon: ChevronsDownUp,
      key: 'collapseAll',
      label: t('snippets.menu.collapseAll'),
      onClick: args.onCollapseAll,
    },
    { key: 'sep-3', type: 'divider' },
    {
      danger: true,
      icon: Trash2,
      key: 'delete',
      label: t('snippets.menu.deleteFolder', { count: fileCount }),
      onClick: args.onDelete,
    },
  ]
}
