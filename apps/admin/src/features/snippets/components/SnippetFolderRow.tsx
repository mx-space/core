import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  Folder,
  FolderOpen,
} from 'lucide-react'
import type { DragEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import type { SnippetTreeFolder } from './SnippetList'

interface SnippetFolderRowProps {
  children: React.ReactNode
  expanded: boolean
  focusedPath: string | null
  folder: SnippetTreeFolder
  level: number
  onContextMenu?: (folder: SnippetTreeFolder) => void
  onCreateFileInFolder: (prefix: string) => void
  onDragEnd?: () => void
  onDragStart?: (path: string, kind: 'folder') => void
  onDropTo?: (targetPrefix: string) => void
  onFocus?: () => void
  onRenameCancel: () => void
  onRenameCommit: (path: string, draft: string) => void
  onSelectFolder: (prefix: string) => void
  onStartRename: (path: string) => void
  onToggleFolder: (prefix: string) => void
  renamingPath: string | null
  selected: boolean
  shouldAcceptDrop?: (targetPrefix: string) => boolean
}

export function SnippetFolderRow(props: SnippetFolderRowProps) {
  const { folder } = props
  const { t } = useI18n()
  const isFocused = props.focusedPath === folder.path
  const isRenaming = props.renamingPath === folder.path
  const [isDropTarget, setIsDropTarget] = useState(false)

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!props.shouldAcceptDrop) return
    if (!props.shouldAcceptDrop(folder.path)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    if (!isDropTarget) setIsDropTarget(true)
  }
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the row itself, not when crossing into children.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDropTarget(false)
  }
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!props.onDropTo) return
    if (!props.shouldAcceptDrop?.(folder.path)) return
    event.preventDefault()
    event.stopPropagation()
    setIsDropTarget(false)
    props.onDropTo(folder.path)
  }

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
          isDropTarget &&
            'bg-accent-soft ring-accent/40 ring-1 ring-inset hover:bg-accent-soft',
        )}
        data-drop-target={isDropTarget ? 'true' : undefined}
        data-tree-path={folder.path}
        draggable={!isRenaming}
        onContextMenu={(event) => {
          if (!props.onContextMenu) return
          event.preventDefault()
          props.onFocus?.()
          props.onContextMenu(folder)
        }}
        onDragEnd={() => {
          setIsDropTarget(false)
          props.onDragEnd?.()
        }}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={(event) => {
          if (isRenaming) {
            event.preventDefault()
            return
          }
          event.dataTransfer.setData('application/x-snippet-path', folder.path)
          event.dataTransfer.effectAllowed = 'move'
          event.stopPropagation()
          props.onDragStart?.(folder.path, 'folder')
        }}
        onDrop={handleDrop}
        role="treeitem"
        style={{ paddingLeft: 8 + props.level * 14 }}
        tabIndex={isFocused ? 0 : -1}
      >
        <button
          aria-label={props.expanded ? 'Collapse folder' : 'Expand folder'}
          className="flex size-5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          onClick={() => {
            props.onFocus?.()
            props.onToggleFolder(folder.path)
          }}
          type="button"
        >
          {props.expanded ? (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          )}
        </button>
        {isRenaming ? (
          <FolderRenameField
            onCancel={props.onRenameCancel}
            onCommit={(draft) => props.onRenameCommit(folder.path, draft)}
            originalName={folder.name}
          />
        ) : (
          <>
            <button
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              onClick={() => {
                props.onFocus?.()
                props.onSelectFolder(folder.path)
              }}
              onDoubleClick={() => props.onStartRename(folder.path)}
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
          </>
        )}
      </div>
      {props.children}
    </div>
  )
}

interface FolderRenameFieldProps {
  onCancel: () => void
  onCommit: (draft: string) => void
  originalName: string
}

function FolderRenameField(props: FolderRenameFieldProps) {
  const [value, setValue] = useState(props.originalName)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(0, el.value.length)
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    props.onCommit(value)
  }

  return (
    <TextInput
      autoComplete="off"
      controlClassName="h-7 min-w-0 flex-1 px-1.5 text-sm focus:border-neutral-400 focus:ring-0"
      onBlur={commit}
      onChange={setValue}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          committedRef.current = true
          props.onCancel()
        }
      }}
      ref={inputRef}
      spellCheck={false}
      value={value}
    />
  )
}
