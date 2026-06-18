import { useCallback, useState } from 'react'

export interface DragState {
  kind: 'file' | 'folder'
  sourcePath: string
}

export interface UseTreeDragReturn {
  dragging: DragState | null
  endDrag: () => void
  isLegalTarget: (targetPrefix: string) => boolean
  onDropTo: (targetPrefix: string) => Promise<void>
  startDrag: (path: string, kind: 'file' | 'folder') => void
}

interface UseTreeDragArgs {
  checkedSize: number
  clearChecked: () => void
  isChecked: (path: string) => boolean
  onCommitMove: (args: {
    from: string
    recursive: boolean
    to: string
  }) => Promise<void>
}

function parentPrefixOf(path: string): string {
  const isFolder = path.endsWith('/')
  const trimmed = isFolder ? path.slice(0, -1) : path
  const index = trimmed.lastIndexOf('/')
  return index === -1 ? '' : trimmed.slice(0, index + 1)
}

function lastSegmentOf(folderPath: string): string {
  // expects 'foo/bar/'
  const trimmed = folderPath.endsWith('/')
    ? folderPath.slice(0, -1)
    : folderPath
  const index = trimmed.lastIndexOf('/')
  return index === -1 ? trimmed : trimmed.slice(index + 1)
}

function basenameOf(filePath: string): string {
  const index = filePath.lastIndexOf('/')
  return index === -1 ? filePath : filePath.slice(index + 1)
}

export function useTreeDrag(args: UseTreeDragArgs): UseTreeDragReturn {
  const { checkedSize, clearChecked, isChecked, onCommitMove } = args
  const [dragging, setDragging] = useState<DragState | null>(null)

  const startDrag = useCallback(
    (path: string, kind: 'file' | 'folder') => {
      // Per spec: if source not in checked AND there is a multi-selection,
      // clear it. If source is in checked with >1, silently downgrade — leave
      // checked intact visually, drop will operate on sourcePath alone.
      if (checkedSize > 0 && !isChecked(path)) {
        clearChecked()
      }
      setDragging({ kind, sourcePath: path })
    },
    [checkedSize, clearChecked, isChecked],
  )

  const endDrag = useCallback(() => {
    setDragging(null)
  }, [])

  const isLegalTarget = useCallback(
    (targetPrefix: string): boolean => {
      if (!dragging) return false
      const { kind, sourcePath } = dragging
      // illegal: drop on self folder
      if (targetPrefix === sourcePath) return false
      // illegal: folder into descendant (or self)
      if (kind === 'folder' && targetPrefix.startsWith(sourcePath)) return false
      // illegal: same-parent no-op
      const parent = parentPrefixOf(sourcePath)
      if (targetPrefix === parent) return false
      return true
    },
    [dragging],
  )

  const onDropTo = useCallback(
    async (targetPrefix: string) => {
      if (!dragging) return
      if (!isLegalTarget(targetPrefix)) return
      const { kind, sourcePath } = dragging
      const to =
        kind === 'folder'
          ? `${targetPrefix}${lastSegmentOf(sourcePath)}/`
          : `${targetPrefix}${basenameOf(sourcePath)}`
      await onCommitMove({
        from: sourcePath,
        recursive: kind === 'folder',
        to,
      })
    },
    [dragging, isLegalTarget, onCommitMove],
  )

  return { dragging, endDrag, isLegalTarget, onDropTo, startDrag }
}
