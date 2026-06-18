import { useEffect } from 'react'

import type { SnippetModel } from '~/models/snippet'

import type {
  SnippetTreeFolder,
  SnippetTreeNode,
} from '../components/SnippetList'

interface UseTreeKeyboardArgs {
  scopeId: string
  nodes: SnippetTreeNode[]
  expandedPrefixes: Record<string, boolean>
  focusedPath: string | null
  setFocusedPath: (path: string | null) => void
  onToggleExpand: (path: string) => void
  onSelectFile: (snippet: SnippetModel) => void
  onRename: (path: string) => void
  onDelete: (path: string) => void
  onEscape?: () => boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  disabled?: boolean
}

interface VisibleEntry {
  path: string
  kind: 'file' | 'folder'
  folder?: SnippetTreeFolder
  file?: SnippetModel
  parentPath: string | null
}

function flattenVisible(
  nodes: SnippetTreeNode[],
  expandedPrefixes: Record<string, boolean>,
): VisibleEntry[] {
  const out: VisibleEntry[] = []
  const visit = (node: SnippetTreeNode, parentPath: string | null) => {
    if (node.kind === 'file') {
      out.push({
        file: node.snippet,
        kind: 'file',
        parentPath,
        path: node.path,
      })
      return
    }
    out.push({
      folder: node,
      kind: 'folder',
      parentPath,
      path: node.path,
    })
    const expanded = expandedPrefixes[node.path] ?? true
    if (expanded) {
      for (const child of node.children) visit(child, node.path)
    }
  }
  for (const node of nodes) visit(node, null)
  return out
}

function isTextInputTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (el.isContentEditable) return true
  return false
}

export function useTreeKeyboard(args: UseTreeKeyboardArgs): void {
  const {
    disabled,
    expandedPrefixes,
    focusedPath,
    nodes,
    onDelete,
    onEscape,
    onRename,
    onSelectFile,
    onToggleExpand,
    scopeId,
    searchInputRef,
    setFocusedPath,
  } = args

  useEffect(() => {
    if (disabled) return

    const handler = (event: KeyboardEvent) => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return
      const scopeEl = active.closest<HTMLElement>(
        `[data-focus-scope="${scopeId}"]`,
      )
      if (!scopeEl) return

      // '/' focuses the search input. Don't intercept if already in a text input.
      if (event.key === '/') {
        if (isTextInputTarget(active)) return
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select?.()
        return
      }

      // Don't intercept keystrokes inside text inputs.
      if (isTextInputTarget(active)) return

      const visible = flattenVisible(nodes, expandedPrefixes)
      if (visible.length === 0) return

      const currentIndex = focusedPath
        ? visible.findIndex((entry) => entry.path === focusedPath)
        : -1
      const current = currentIndex >= 0 ? visible[currentIndex] : null

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          const nextIndex =
            currentIndex < 0
              ? 0
              : Math.min(currentIndex + 1, visible.length - 1)
          setFocusedPath(visible[nextIndex].path)
          return
        }
        case 'ArrowUp': {
          event.preventDefault()
          const nextIndex =
            currentIndex < 0
              ? visible.length - 1
              : Math.max(currentIndex - 1, 0)
          setFocusedPath(visible[nextIndex].path)
          return
        }
        case 'ArrowRight': {
          if (!current) return
          event.preventDefault()
          if (current.kind !== 'folder') return
          const expanded = expandedPrefixes[current.path] ?? true
          if (!expanded) {
            onToggleExpand(current.path)
            return
          }
          // expanded → focus first child if any
          const firstChild = current.folder?.children[0]
          if (firstChild) setFocusedPath(firstChild.path)
          return
        }
        case 'ArrowLeft': {
          if (!current) return
          event.preventDefault()
          if (current.kind === 'folder') {
            const expanded = expandedPrefixes[current.path] ?? true
            if (expanded) {
              onToggleExpand(current.path)
              return
            }
          }
          if (current.parentPath) setFocusedPath(current.parentPath)
          return
        }
        case 'Enter': {
          if (!current) return
          event.preventDefault()
          if (current.kind === 'file' && current.file) {
            onSelectFile(current.file)
          } else if (current.kind === 'folder') {
            onToggleExpand(current.path)
          }
          return
        }
        case 'F2': {
          if (!focusedPath) return
          event.preventDefault()
          onRename(focusedPath)
          return
        }
        case 'Delete':
        case 'Backspace': {
          if (!focusedPath) return
          event.preventDefault()
          onDelete(focusedPath)
          return
        }
        case 'Escape': {
          if (onEscape?.()) {
            event.preventDefault()
          }
          return
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    disabled,
    expandedPrefixes,
    focusedPath,
    nodes,
    onDelete,
    onEscape,
    onRename,
    onSelectFile,
    onToggleExpand,
    scopeId,
    searchInputRef,
    setFocusedPath,
  ])
}
