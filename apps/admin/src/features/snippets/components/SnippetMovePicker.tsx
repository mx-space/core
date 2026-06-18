import { CornerDownLeft, FolderPlus, Loader2 } from 'lucide-react'
import type { KeyboardEventHandler } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { Modal } from '~/ui/feedback/modal'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import type { SnippetTreeNode } from './SnippetList'

export interface SnippetMovePickerProps {
  isFolderSource: boolean
  onClose: () => void
  onCommit: (targetPrefix: string) => Promise<void> | void
  open: boolean
  sourcePaths: string[]
  treeNodes: SnippetTreeNode[]
}

interface FolderOption {
  illegal?: boolean
  isRoot: boolean
  label: string
  /** 0 = exact segment, 1 = substring, 2 = root */
  matchScore: number
  prefix: string
}

export function basenameOf(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const i = trimmed.lastIndexOf('/')
  return i === -1 ? trimmed : trimmed.slice(i + 1)
}

function parentOf(path: string): string {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const i = trimmed.lastIndexOf('/')
  return i === -1 ? '' : trimmed.slice(0, i + 1)
}

function normalizeTargetInput(value: string): string {
  let v = value.trim().replaceAll(/^\/+/g, '')
  if (!v) return ''
  if (!v.endsWith('/')) v = `${v}/`
  return v
}

function collectFolderPaths(nodes: SnippetTreeNode[]): string[] {
  const out: string[] = []
  const visit = (node: SnippetTreeNode) => {
    if (node.kind === 'folder') {
      out.push(node.path)
      node.children.forEach(visit)
    }
  }
  nodes.forEach(visit)
  return out
}

function isIllegalTarget(
  targetPrefix: string,
  sourcePaths: string[],
  isFolderSource: boolean,
): boolean {
  for (const source of sourcePaths) {
    if (parentOf(source) === targetPrefix) return true
    if (
      isFolderSource &&
      source.endsWith('/') &&
      (targetPrefix === source || targetPrefix.startsWith(source))
    )
      return true
  }
  return false
}

export function SnippetMovePicker(props: SnippetMovePickerProps) {
  const { t } = useI18n()
  const { isFolderSource, onClose, onCommit, open, sourcePaths, treeNodes } =
    props
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(0)
    setSubmitting(false)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const folderPaths = useMemo(() => collectFolderPaths(treeNodes), [treeNodes])
  const normalizedQuery = useMemo(() => normalizeTargetInput(query), [query])
  const queryLower = query.trim().toLowerCase()

  const rootLabel = t('snippets.move.root')
  const options: FolderOption[] = useMemo(() => {
    const root: FolderOption = {
      isRoot: true,
      label: rootLabel,
      matchScore: 2,
      prefix: '',
    }
    const folders = folderPaths.map<FolderOption>((path) => {
      const segment = basenameOf(path).toLowerCase()
      return {
        isRoot: false,
        label: path,
        matchScore: queryLower && segment === queryLower ? 0 : 1,
        prefix: path,
      }
    })
    const all = [root, ...folders]
    const filtered = !queryLower
      ? all
      : all.filter((opt) =>
          opt.isRoot
            ? rootLabel.toLowerCase().includes(queryLower)
            : opt.label.toLowerCase().includes(queryLower),
        )
    filtered.sort((a, b) => a.matchScore - b.matchScore)
    return filtered.map((opt) => ({
      ...opt,
      illegal: isIllegalTarget(opt.prefix, sourcePaths, isFolderSource),
    }))
  }, [folderPaths, isFolderSource, queryLower, rootLabel, sourcePaths])

  const showCreateRow =
    normalizedQuery.length > 0 &&
    !options.some((opt) => opt.prefix === normalizedQuery)

  const totalLen = options.length + (showCreateRow ? 1 : 0)

  useEffect(() => {
    if (highlight >= totalLen) setHighlight(Math.max(0, totalLen - 1))
  }, [highlight, totalLen])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${highlight}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const submit = async (prefix: string) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onCommit(prefix)
      onClose()
    } catch {
      // Keep picker open on hard failure so the user can adjust the target
      // and retry. The route surfaces the toast.
    } finally {
      setSubmitting(false)
    }
  }

  const trySubmitIndex = (index: number) => {
    if (index < options.length) {
      const row = options[index]
      if (row.illegal) return
      void submit(row.prefix)
      return
    }
    if (showCreateRow) void submit(normalizedQuery)
  }

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => Math.min(totalLen - 1, h + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (showCreateRow && options.length === 0) {
        void submit(normalizedQuery)
        return
      }
      trySubmitIndex(highlight)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <Modal
      className="w-[20rem]"
      onClose={onClose}
      open={open}
      popupStyle={{ top: '20%', transform: 'translate(-50%, 0)' }}
    >
      <div className="flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
          {t('snippets.move.title')}
        </div>
        <div className="border-b border-border px-3 py-2">
          <TextInput
            autoFocus
            controlClassName="h-8 text-sm"
            disabled={submitting}
            onChange={setQuery}
            onKeyDown={onKeyDown}
            placeholder={t('snippets.move.placeholder')}
            ref={inputRef}
            value={query}
          />
        </div>
        <div
          className="relative max-h-[16rem] overflow-y-auto py-1"
          ref={listRef}
        >
          {options.map((row, index) => (
            <button
              aria-disabled={row.illegal || submitting}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                index === highlight && !row.illegal && 'bg-accent-soft',
                row.illegal
                  ? 'cursor-not-allowed text-fg-subtle opacity-60'
                  : 'text-fg hover:bg-surface-inset',
              )}
              data-row-index={index}
              disabled={submitting}
              key={`${row.prefix}-${index}`}
              onClick={() => {
                if (row.illegal) return
                void submit(row.prefix)
              }}
              onMouseEnter={() => {
                if (!row.illegal) setHighlight(index)
              }}
              type="button"
            >
              <span className="truncate font-mono text-xs">{row.label}</span>
              {index === highlight && !row.illegal ? (
                <CornerDownLeft
                  aria-hidden="true"
                  className="ml-auto size-3.5 text-fg-subtle"
                />
              ) : null}
            </button>
          ))}
          {showCreateRow ? (
            <button
              className={cn(
                'flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-sm transition-colors',
                highlight === options.length
                  ? 'bg-accent-soft text-fg'
                  : 'text-fg hover:bg-surface-inset',
              )}
              data-row-index={options.length}
              disabled={submitting}
              onClick={() => void submit(normalizedQuery)}
              onMouseEnter={() => setHighlight(options.length)}
              type="button"
            >
              <FolderPlus
                aria-hidden="true"
                className="size-3.5 text-fg-muted"
              />
              <span className="truncate text-xs">
                {t('snippets.move.createAndMoveTo', { path: normalizedQuery })}
              </span>
            </button>
          ) : null}
          {options.length === 0 && !showCreateRow ? (
            <div className="px-3 py-4 text-center text-xs text-fg-subtle">
              {t('snippets.list.noResults')}
            </div>
          ) : null}
          {submitting ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-overlay/70">
              <Loader2
                aria-hidden="true"
                className="size-5 animate-spin text-fg-muted"
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
