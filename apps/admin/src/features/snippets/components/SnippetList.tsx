import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import type { ListRowSelectMode } from '~/ui/list-actions'

import { SnippetFileRow } from './SnippetFileRow'
import { SnippetFolderRow } from './SnippetFolderRow'

export { SnippetFileRow } from './SnippetFileRow'
export { SnippetFolderRow } from './SnippetFolderRow'

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
  checked: Set<string>
  expandedPrefixes: Record<string, boolean>
  focusedPath?: string | null
  nodes: SnippetTreeNode[]
  onCreateFileInFolder: (prefix: string) => void
  onDelete: (snippet: SnippetModel) => void
  onDragEnd?: () => void
  onDragStart?: (path: string, kind: 'file' | 'folder') => void
  onDropTo?: (targetPrefix: string) => void
  onFileContextMenu?: (snippet: SnippetModel) => void
  onFocusPath?: (path: string) => void
  onFolderContextMenu?: (folder: SnippetTreeFolder) => void
  onOpenExternal: (snippet: SnippetModel) => void
  onRenameCancel: () => void
  onRenameCommit: (path: string, draft: string) => void
  onSelect: (snippet: SnippetModel, mode: ListRowSelectMode) => void
  onSelectFolder: (prefix: string) => void
  onStartRename: (path: string) => void
  onToggleFolder: (prefix: string) => void
  pendingPaths?: Set<string>
  renamingPath: string | null
  selectedId: string | null
  selectedPrefix: string
  shouldAcceptDrop?: (targetPrefix: string) => boolean
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
        busy={props.pendingPaths?.has(fileNode.path) ?? false}
        checked={props.checked.has(fileNode.path)}
        focusedPath={props.focusedPath ?? null}
        level={props.level}
        multiSelectActive={props.checked.size > 0}
        onContextMenu={props.onFileContextMenu}
        onDelete={() => props.onDelete(fileNode.snippet)}
        onDragEnd={props.onDragEnd}
        onDragStart={(path) => props.onDragStart?.(path, 'file')}
        onFocus={() => props.onFocusPath?.(fileNode.path)}
        onOpenExternal={() => props.onOpenExternal(fileNode.snippet)}
        onRenameCancel={props.onRenameCancel}
        onRenameCommit={props.onRenameCommit}
        onSelect={(mode) => props.onSelect(fileNode.snippet, mode)}
        onStartRename={props.onStartRename}
        renamingPath={props.renamingPath}
        selected={props.selectedId === fileNode.snippet.id}
        snippet={fileNode.snippet}
      />
    )
  }

  const expanded = props.expandedPrefixes[props.node.path] ?? true
  return (
    <SnippetFolderRow
      busy={props.pendingPaths?.has(props.node.path) ?? false}
      expanded={expanded}
      focusedPath={props.focusedPath ?? null}
      folder={props.node}
      level={props.level}
      onContextMenu={props.onFolderContextMenu}
      onCreateFileInFolder={props.onCreateFileInFolder}
      onDragEnd={props.onDragEnd}
      onDragStart={(path) => props.onDragStart?.(path, 'folder')}
      onDropTo={props.onDropTo}
      onFocus={() => props.onFocusPath?.(props.node.path)}
      onRenameCancel={props.onRenameCancel}
      onRenameCommit={props.onRenameCommit}
      onSelectFolder={props.onSelectFolder}
      onStartRename={props.onStartRename}
      onToggleFolder={props.onToggleFolder}
      renamingPath={props.renamingPath}
      selected={props.selectedPrefix === props.node.path}
      shouldAcceptDrop={props.shouldAcceptDrop}
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

export function collectDescendantFolderPaths(
  folder: SnippetTreeFolder,
): string[] {
  const out: string[] = [folder.path]
  const visit = (node: SnippetTreeNode) => {
    if (node.kind !== 'folder') return
    out.push(node.path)
    node.children.forEach(visit)
  }
  folder.children.forEach(visit)
  return out
}

export function countDescendantFiles(folder: SnippetTreeFolder): number {
  let n = 0
  const visit = (node: SnippetTreeNode) => {
    if (node.kind === 'file') {
      n += 1
      return
    }
    node.children.forEach(visit)
  }
  folder.children.forEach(visit)
  return n
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
