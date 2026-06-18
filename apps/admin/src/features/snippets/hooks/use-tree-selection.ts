import { useCallback, useState } from 'react'

import type { SnippetModel } from '~/models/snippet'

export type FileClickMode = 'single' | 'toggle' | 'range'

interface UseTreeSelectionArgs {
  /**
   * Flat list of currently visible files in render order. Folders excluded.
   * Used to resolve Shift+click ranges.
   */
  visibleFiles: SnippetModel[]
  onSelectFile: (snippet: SnippetModel) => void
}

interface UseTreeSelectionReturn {
  checked: Set<string>
  anchorPath: string | null
  clearChecked: () => void
  handleFileClick: (snippet: SnippetModel, mode: FileClickMode) => void
  handleFolderClick: () => void
}

/**
 * Owns the file-only, cross-level multi-select state for the snippet tree.
 * State is lifted into the route view so the same `checked` set can drive
 * row visuals, batch delete, and the multi-select right-click menu branch.
 */
export function useTreeSelection(
  args: UseTreeSelectionArgs,
): UseTreeSelectionReturn {
  const { onSelectFile, visibleFiles } = args
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [anchorPath, setAnchorPath] = useState<string | null>(null)

  const clearChecked = useCallback(() => {
    setChecked((current) => (current.size === 0 ? current : new Set()))
  }, [])

  const handleFileClick = useCallback(
    (snippet: SnippetModel, mode: FileClickMode) => {
      const { path } = snippet
      if (mode === 'toggle') {
        setChecked((current) => {
          const next = new Set(current)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
        setAnchorPath(path)
        return
      }
      if (mode === 'range') {
        const anchorIdx = anchorPath
          ? visibleFiles.findIndex((f) => f.path === anchorPath)
          : -1
        const targetIdx = visibleFiles.findIndex((f) => f.path === path)
        if (anchorIdx === -1 || targetIdx === -1) {
          // Anchor missing/invisible/folder → treat as plain click.
          setChecked(new Set())
          setAnchorPath(path)
          onSelectFile(snippet)
          return
        }
        const [lo, hi] =
          anchorIdx <= targetIdx
            ? [anchorIdx, targetIdx]
            : [targetIdx, anchorIdx]
        const next = new Set<string>()
        for (let i = lo; i <= hi; i++) next.add(visibleFiles[i].path)
        setChecked(next)
        return
      }
      // single
      setChecked((current) => (current.size === 0 ? current : new Set()))
      setAnchorPath(path)
      onSelectFile(snippet)
    },
    [anchorPath, onSelectFile, visibleFiles],
  )

  const handleFolderClick = useCallback(() => {
    setChecked((current) => (current.size === 0 ? current : new Set()))
    setAnchorPath(null)
  }, [])

  return {
    anchorPath,
    checked,
    clearChecked,
    handleFileClick,
    handleFolderClick,
  }
}
