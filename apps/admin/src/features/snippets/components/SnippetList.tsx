import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  ChevronRight,
  Code,
  ExternalLink,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FunctionSquare,
  Lock,
  Trash2,
} from 'lucide-react'

import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

export interface SnippetTreeFolder {
  kind: 'folder'
  name: string
  path: string
  count: number
  staged: boolean
  children: SnippetTreeNode[]
}

export interface SnippetTreeFile {
  kind: 'file'
  name: string
  path: string
  snippet: SnippetModel
}

export type SnippetTreeNode = SnippetTreeFolder | SnippetTreeFile

interface SnippetListProps {
  expandedPrefixes: Record<string, boolean>
  focusedPath?: string | null
  nodes: SnippetTreeNode[]
  onCreateFileInFolder: (prefix: string) => void
  onDelete: (snippet: SnippetModel) => void
  onOpenExternal: (snippet: SnippetModel) => void
  onSelect: (snippet: SnippetModel) => void
  onSelectFolder: (prefix: string) => void
  onToggleFolder: (prefix: string) => void
  selectedId: string | null
  selectedPrefix: string
}

export function SnippetList(props: SnippetListProps) {
  const { t } = useI18n()
  return (
    <div
      aria-label={t('snippets.list.treeLabel')}
      aria-multiselectable="true"
      className="py-1"
      role="tree"
    >
      {props.nodes.map((node) => (
        <SnippetTreeNodeRow key={node.path} level={0} node={node} {...props} />
      ))}
    </div>
  )
}

function SnippetTreeNodeRow(
  props: SnippetListProps & {
    level: number
    node: SnippetTreeNode
  },
) {
  if (props.node.kind === 'file') {
    const fileNode = props.node
    return (
      <SnippetFileRow
        focusedPath={props.focusedPath ?? null}
        level={props.level}
        onDelete={() => props.onDelete(fileNode.snippet)}
        onOpenExternal={() => props.onOpenExternal(fileNode.snippet)}
        onSelect={() => props.onSelect(fileNode.snippet)}
        selected={props.selectedId === fileNode.snippet.id}
        snippet={fileNode.snippet}
      />
    )
  }

  const expanded = props.expandedPrefixes[props.node.path] ?? true
  return (
    <SnippetFolderRow
      expanded={expanded}
      focusedPath={props.focusedPath ?? null}
      folder={props.node}
      level={props.level}
      onCreateFileInFolder={props.onCreateFileInFolder}
      onSelectFolder={props.onSelectFolder}
      onToggleFolder={props.onToggleFolder}
      selected={props.selectedPrefix === props.node.path}
    >
      {expanded
        ? props.node.children.map((child) => (
            <SnippetTreeNodeRow
              key={child.path}
              {...props}
              level={props.level + 1}
              node={child}
            />
          ))
        : null}
    </SnippetFolderRow>
  )
}

function SnippetFolderRow(props: {
  children: React.ReactNode
  expanded: boolean
  focusedPath: string | null
  folder: SnippetTreeFolder
  level: number
  onCreateFileInFolder: (prefix: string) => void
  onSelectFolder: (prefix: string) => void
  onToggleFolder: (prefix: string) => void
  selected: boolean
}) {
  const { folder } = props
  const { t } = useI18n()
  const isFocused = props.focusedPath === folder.path
  return (
    <div>
      <div
        aria-expanded={props.expanded}
        aria-level={props.level + 1}
        aria-selected={isFocused}
        className={cn(
          'group flex h-8 w-full select-none items-center gap-1.5 pr-2 text-sm transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800/50',
          props.selected
            ? 'bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50'
            : 'text-neutral-700 dark:text-neutral-300',
        )}
        data-tree-path={folder.path}
        role="treeitem"
        style={{ paddingLeft: 8 + props.level * 14 }}
        tabIndex={isFocused ? 0 : -1}
      >
        <button
          aria-label={props.expanded ? 'Collapse folder' : 'Expand folder'}
          className="flex size-5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          onClick={() => props.onToggleFolder(folder.path)}
          type="button"
        >
          {props.expanded ? (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          )}
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => props.onSelectFolder(folder.path)}
          type="button"
        >
          {props.expanded ? (
            <FolderOpen
              aria-hidden="true"
              className={cn(
                'size-4',
                props.selected
                  ? 'text-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-400',
              )}
            />
          ) : (
            <Folder
              aria-hidden="true"
              className={cn(
                'size-4',
                props.selected
                  ? 'text-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 dark:text-neutral-400',
              )}
            />
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              props.selected
                ? 'font-medium text-neutral-950 dark:text-neutral-50'
                : 'text-neutral-700 dark:text-neutral-300',
            )}
          >
            {folder.name}
          </span>
          {folder.staged ? (
            <span
              aria-label={t('snippets.list.pendingFolder')}
              className="size-1.5 shrink-0 rounded-full bg-amber-500"
              title={t('snippets.list.pendingFolder')}
            />
          ) : null}
          {folder.count > 0 ? (
            <span className="text-xs tabular-nums text-neutral-400">
              {folder.count}
            </span>
          ) : null}
        </button>
        <button
          aria-label={t('snippets.list.newFile')}
          className="rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onClick={() => props.onCreateFileInFolder(folder.path)}
          title={t('snippets.list.newFile')}
          type="button"
        >
          <FilePlus aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {props.children}
    </div>
  )
}

const typeIconMap: Record<SnippetType, LucideIcon> = {
  [SnippetType.JSON]: FileJson,
  [SnippetType.JSON5]: Code,
  [SnippetType.Function]: FunctionSquare,
  [SnippetType.Skill]: FileText,
  [SnippetType.Text]: FileText,
  [SnippetType.YAML]: FileCode,
}

const typeIconColorMap: Record<SnippetType, string> = {
  [SnippetType.JSON]: 'text-orange-500',
  [SnippetType.JSON5]: 'text-purple-500',
  [SnippetType.Function]: 'text-blue-500',
  [SnippetType.Skill]: 'text-teal-500',
  [SnippetType.Text]: 'text-neutral-500',
  [SnippetType.YAML]: 'text-red-500',
}

function SnippetFileRow(props: {
  focusedPath: string | null
  level: number
  onDelete: () => void
  onOpenExternal: () => void
  onSelect: () => void
  selected: boolean
  snippet: SnippetModel
}) {
  const { t } = useI18n()
  const { snippet } = props
  const Icon = typeIconMap[snippet.type] ?? FileText
  const iconColor = typeIconColorMap[snippet.type] ?? 'text-neutral-500'
  const disabled = snippet.enable === false
  const fileName = snippet.path.split('/').at(-1) || snippet.path
  const isFocused = props.focusedPath === snippet.path

  return (
    <div
      aria-level={props.level + 1}
      aria-selected={isFocused}
      data-tree-path={snippet.path}
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
    >
      <ListRow
        ariaCurrent={props.selected}
        className={cn(
          'group flex h-8 w-full cursor-pointer items-center gap-1.5 px-2 transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800/50',
          props.selected ? 'bg-neutral-100 dark:bg-neutral-800' : null,
        )}
        dataId={snippet.id}
        onSelect={props.onSelect}
        selected={props.selected}
      >
        {props.level > 0 ? (
          <span
            aria-hidden="true"
            className="shrink-0"
            style={{ width: 25 + props.level * 14 }}
          />
        ) : (
          <span aria-hidden="true" className="w-[25px] shrink-0" />
        )}
        <Icon aria-hidden="true" className={cn('size-3 shrink-0', iconColor)} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            disabled
              ? 'text-neutral-400 line-through dark:text-neutral-500'
              : 'text-neutral-700 dark:text-neutral-300',
            props.selected && 'font-medium text-neutral-900 dark:text-white',
          )}
        >
          {fileName || t('snippets.list.unnamed')}
        </span>
        {snippet.private ? (
          <Lock
            aria-hidden="true"
            className="size-3 shrink-0 text-neutral-400"
          />
        ) : null}
        <span className="shrink-0 rounded bg-neutral-100 px-1 py-0.5 text-[10px] uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {snippet.type}
        </span>
        <button
          aria-label={t('snippets.list.openExternal')}
          className="rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onClick={(event) => {
            event.stopPropagation()
            props.onOpenExternal()
          }}
          title={t('snippets.list.openExternal')}
          type="button"
        >
          <ExternalLink aria-hidden="true" className="size-3" />
        </button>
        <button
          aria-label={
            snippet.builtIn && snippet.type === SnippetType.Function
              ? t('snippets.editor.action.reset')
              : t('snippets.editor.action.delete')
          }
          className="rounded p-0.5 text-red-500 opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100 dark:hover:bg-red-900/50"
          onClick={(event) => {
            event.stopPropagation()
            props.onDelete()
          }}
          title={
            snippet.builtIn && snippet.type === SnippetType.Function
              ? t('snippets.editor.action.reset')
              : t('snippets.editor.action.delete')
          }
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-3" />
        </button>
      </ListRow>
    </div>
  )
}

export function buildSnippetTree(
  snippets: SnippetModel[],
  stagedPrefixes: string[],
): SnippetTreeNode[] {
  const root = new Map<string, SnippetTreeNode>()

  const ensureFolder = (
    siblings: Map<string, SnippetTreeNode>,
    name: string,
    path: string,
    staged = false,
  ) => {
    const existing = siblings.get(path)
    if (existing?.kind === 'folder') {
      existing.staged &&= staged
      return existing
    }
    const folder: SnippetTreeFolder = {
      children: [],
      count: 0,
      kind: 'folder',
      name,
      path,
      staged,
    }
    siblings.set(path, folder)
    return folder
  }

  const insertFolder = (prefix: string, staged: boolean) => {
    const segments = prefix
      .replaceAll(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean)
    let siblings = root
    let currentPath = ''
    for (const segment of segments) {
      currentPath = `${currentPath}${segment}/`
      const folder = ensureFolder(siblings, segment, currentPath, staged)
      siblings = childrenMap(folder)
    }
  }

  const insertFile = (snippet: SnippetModel) => {
    const segments = snippet.path.split('/').filter(Boolean)
    let siblings = root
    let currentPath = ''
    for (const segment of segments.slice(0, -1)) {
      currentPath = `${currentPath}${segment}/`
      const folder = ensureFolder(siblings, segment, currentPath)
      folder.count += 1
      siblings = childrenMap(folder)
    }
    const fileName = segments.at(-1) || snippet.path
    siblings.set(snippet.path, {
      kind: 'file',
      name: fileName,
      path: snippet.path,
      snippet,
    })
  }

  for (const prefix of stagedPrefixes) insertFolder(prefix, true)
  for (const snippet of snippets) insertFile(snippet)

  return sortNodes([...root.values()])
}

export function flattenVisibleSnippets(
  nodes: SnippetTreeNode[],
  expandedPrefixes: Record<string, boolean>,
): SnippetModel[] {
  const out: SnippetModel[] = []
  const visit = (node: SnippetTreeNode) => {
    if (node.kind === 'file') {
      out.push(node.snippet)
      return
    }
    if (expandedPrefixes[node.path] ?? true) {
      node.children.forEach(visit)
    }
  }
  nodes.forEach(visit)
  return out
}

export function filterTreeBySearch(
  nodes: SnippetTreeNode[],
  search: string,
): SnippetTreeNode[] {
  const query = search.trim().toLowerCase()
  if (!query) return nodes

  const filterNode = (node: SnippetTreeNode): SnippetTreeNode | null => {
    if (node.kind === 'file') {
      const matched =
        node.snippet.path.toLowerCase().includes(query) ||
        node.snippet.comment?.toLowerCase().includes(query)
      return matched ? node : null
    }

    const children = node.children
      .map(filterNode)
      .filter((child): child is SnippetTreeNode => child !== null)
    const matched = node.path.toLowerCase().includes(query)
    if (!matched && children.length === 0) return null
    return { ...node, children }
  }

  return nodes
    .map(filterNode)
    .filter((node): node is SnippetTreeNode => node !== null)
}

function childrenMap(folder: SnippetTreeFolder) {
  const map = new Map<string, SnippetTreeNode>()
  for (const child of folder.children) map.set(child.path, child)
  folder.children = [...map.values()]
  return {
    get: map.get.bind(map),
    set(path: string, node: SnippetTreeNode) {
      map.set(path, node)
      folder.children = sortNodes([...map.values()])
      return map
    },
    values: map.values.bind(map),
  } as Map<string, SnippetTreeNode>
}

function sortNodes(nodes: SnippetTreeNode[]) {
  return nodes.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}
