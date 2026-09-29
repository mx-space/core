import { mxLexicalToMarkdown } from '@mx-space/editor'
import type { SerializedEditorState } from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DiffRendererInstance } from '../features/drafts/types/drafts'
import { ensureDiffHighlighter } from '../features/drafts/utils/diff-highlighter'
import { RichRenderer } from '../vendor/rich-editor/core/RichRenderer'
import {
  groupHistory,
  type HistoryEntry,
  type HistoryId,
  type HistoryRow,
} from './history'

interface Props {
  theme: 'light' | 'dark'
  variant: 'article' | 'note'
  onClose: () => void
}

const labelOf = (row: HistoryRow): string => {
  switch (row.kind) {
    case 'human': {
      return row.count > 1 ? `你的编辑 ×${row.count}` : '你的编辑'
    }
    case 'agent': {
      return `Agent ${row.message.replace(/^agent:\s*/, '')}`
    }
    case 'session': {
      return '打开会话'
    }
    case 'restore': {
      return '恢复'
    }
    default: {
      return row.message || '变更'
    }
  }
}

const sameId = (a: HistoryId | undefined, b: HistoryId) =>
  a?.peer === b.peer && a.counter === b.counter

function ChangesView({
  before,
  after,
}: {
  before: SerializedEditorState
  after: SerializedEditorState
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const oldText = mxLexicalToMarkdown(before as never)
    const newText = mxLexicalToMarkdown(after as never)
    setEmpty(oldText === newText)
    setError(null)
    if (oldText === newText) return
    let disposed = false
    let instance: DiffRendererInstance | null = null
    void import('@pierre/diffs')
      .then(async ({ FileDiff, preloadHighlighter }) => {
        await ensureDiffHighlighter(preloadHighlighter)
        if (disposed) return
        instance = new FileDiff({
          diffIndicators: 'bars',
          diffStyle: 'unified',
          disableFileHeader: true,
          overflow: 'wrap',
          themeType: 'system',
        }) as unknown as DiffRendererInstance
        instance.render({
          containerWrapper: container,
          oldFile: { contents: oldText, name: 'before.md' },
          newFile: { contents: newText, name: 'after.md' },
        })
      })
      .catch((err: unknown) => {
        if (!disposed)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      disposed = true
      instance?.cleanUp()
      container.innerHTML = ''
    }
  }, [before, after])

  if (empty) return <p className="text-xs text-fg-muted">这一步没有改动正文</p>
  return (
    <>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : null}
      <div ref={containerRef} className="-mx-3" />
    </>
  )
}

export function HistoryPanel({ theme, variant, onClose }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [selected, setSelected] = useState<HistoryRow | null>(null)
  const [preview, setPreview] = useState<SerializedEditorState | null>(null)
  const [before, setBefore] = useState<SerializedEditorState | null>(null)
  const [view, setView] = useState<'changes' | 'full'>('changes')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      const json = (await res.json()) as { entries: HistoryEntry[] }
      setRows(groupHistory(json.entries))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const select = async (row: HistoryRow) => {
    setSelected(row)
    setPreview(null)
    setBefore(null)
    const query = new URLSearchParams({
      peer: row.id.peer,
      counter: String(row.id.counter),
      before: JSON.stringify(row.before),
    })
    const res = await fetch(`/api/history/preview?${query}`)
    const json = (await res.json()) as {
      lexical: SerializedEditorState
      before: SerializedEditorState | null
    }
    setPreview(json.lexical)
    setBefore(json.before)
  }

  const restore = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/history/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selected.id),
      })
      if (!res.ok) throw new Error(`restore failed (${res.status})`)
      setSelected(null)
      setPreview(null)
      setBefore(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-surface-card">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="flex-1 text-sm font-medium">历史</span>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-fg-muted hover:text-fg"
        >
          刷新
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-fg-muted hover:text-fg"
        >
          关闭
        </button>
      </div>
      {error ? (
        <p className="px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <ol className="max-h-72 shrink-0 overflow-auto border-b border-border">
        {rows.map((row) => (
          <li key={`${row.id.peer}:${row.id.counter}`}>
            <button
              type="button"
              onClick={() => void select(row)}
              className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-inset ${
                sameId(selected?.id, row.id) ? 'bg-surface-inset' : ''
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{labelOf(row)}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                {new Date(row.timestamp * 1000).toLocaleTimeString()}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-1 gap-1 text-xs">
              {(['changes', 'full'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-sm px-2 py-0.5 ${
                    view === mode
                      ? 'bg-surface-inset text-fg'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {mode === 'changes' ? '这一步的改动' : '完整版本'}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !preview}
              onClick={() => void restore()}
              className="rounded-sm bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:bg-surface-inset disabled:text-fg-subtle"
            >
              恢复到这里
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
            {preview && view === 'changes' && before ? (
              <ChangesView before={before} after={preview} />
            ) : preview ? (
              <RichRenderer theme={theme} value={preview} variant={variant} />
            ) : (
              <p className="text-xs text-fg-muted">加载中…</p>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
