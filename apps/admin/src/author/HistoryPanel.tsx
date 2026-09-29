import type { SerializedEditorState } from 'lexical'
import { useCallback, useEffect, useState } from 'react'

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

export function HistoryPanel({ theme, variant, onClose }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [selected, setSelected] = useState<HistoryRow | null>(null)
  const [preview, setPreview] = useState<SerializedEditorState | null>(null)
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
    const query = new URLSearchParams({
      peer: row.id.peer,
      counter: String(row.id.counter),
    })
    const res = await fetch(`/api/history/preview?${query}`)
    const json = (await res.json()) as { lexical: SerializedEditorState }
    setPreview(json.lexical)
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
            <span className="flex-1 text-xs text-fg-muted">只读预览</span>
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
            {preview ? (
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
