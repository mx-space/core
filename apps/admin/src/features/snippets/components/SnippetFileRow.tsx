import type { LucideIcon } from 'lucide-react'
import {
  Code,
  ExternalLink,
  FileCode,
  FileJson,
  FileText,
  FunctionSquare,
  Lock,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { ListRow } from '~/ui/list-actions'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

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

interface SnippetFileRowProps {
  focusedPath: string | null
  level: number
  onContextMenu?: (snippet: SnippetModel) => void
  onDelete: () => void
  onFocus?: () => void
  onOpenExternal: () => void
  onRenameCancel: () => void
  onRenameCommit: (path: string, draft: string) => void
  onSelect: () => void
  onStartRename: (path: string) => void
  renamingPath: string | null
  selected: boolean
  snippet: SnippetModel
}

export function SnippetFileRow(props: SnippetFileRowProps) {
  const { t } = useI18n()
  const { snippet } = props
  const Icon = typeIconMap[snippet.type] ?? FileText
  const iconColor = typeIconColorMap[snippet.type] ?? 'text-neutral-500'
  const disabled = snippet.enable === false
  const fileName = snippet.path.split('/').at(-1) || snippet.path
  const isFocused = props.focusedPath === snippet.path
  const isRenaming = props.renamingPath === snippet.path

  return (
    <div
      aria-level={props.level + 1}
      aria-selected={isFocused}
      data-tree-path={snippet.path}
      onContextMenu={(event) => {
        if (!props.onContextMenu) return
        event.preventDefault()
        props.onFocus?.()
        props.onContextMenu(snippet)
      }}
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
        onSelect={() => {
          if (isRenaming) return
          props.onFocus?.()
          props.onSelect()
        }}
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
        {isRenaming ? (
          <FileRenameField
            onCancel={props.onRenameCancel}
            onCommit={(draft) => props.onRenameCommit(snippet.path, draft)}
            originalName={fileName}
          />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              disabled
                ? 'text-neutral-400 line-through dark:text-neutral-500'
                : 'text-neutral-700 dark:text-neutral-300',
              props.selected && 'font-medium text-neutral-900 dark:text-white',
            )}
            onDoubleClick={(event) => {
              event.stopPropagation()
              props.onStartRename(snippet.path)
            }}
          >
            {fileName || t('snippets.list.unnamed')}
          </span>
        )}
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

interface FileRenameFieldProps {
  onCancel: () => void
  onCommit: (draft: string) => void
  originalName: string
}

function FileRenameField(props: FileRenameFieldProps) {
  const [value, setValue] = useState(props.originalName)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // Select everything before the first dot in the basename. The whole input
    // stays editable — this is a default convenience. For dotfiles (e.g.
    // `.env`) or no-extension names (e.g. `README`), select the whole value.
    const firstDot = el.value.indexOf('.')
    const end = firstDot <= 0 ? el.value.length : firstDot
    el.setSelectionRange(0, end)
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
