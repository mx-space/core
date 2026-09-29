import { AgentDiffEditNode } from '@haklex/rich-ext-ai-agent'
import { LoroDoc } from 'loro-crdt'
import { useCallback, useEffect, useState } from 'react'

import { RichEditor } from '../vendor/rich-editor/core/RichEditor'
import { AgentCursor, type AgentCursorPosition } from './AgentCursor'
import { DiffNotePlugin } from './DiffNotePlugin'
import { HistoryPanel } from './HistoryPanel'
import { LoroSyncPlugin, type SyncStatus } from './LoroSyncPlugin'
import { SelectionSyncPlugin } from './SelectionSyncPlugin'

const extraNodes = [AgentDiffEditNode]

const HUMAN_CHANGE_MERGE_SECONDS = 20

type Variant = 'article' | 'note'

interface DocumentResponse {
  snapshot: string
  variant: Variant
  fileName: string
  invalid: string | null
}

type Theme = 'light' | 'dark'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const saveLabel = isMac ? '⌘S' : 'Ctrl+S'

const statusLabel: Record<SyncStatus, string> = {
  synced: '已同步',
  syncing: '同步中…',
  offline: '连接断开',
}

const useTheme = (): Theme => {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light'
      setTheme(next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return theme
}

export function AuthorApp() {
  const theme = useTheme()
  const [meta, setMeta] = useState<DocumentResponse | null>(null)
  const [doc, setDoc] = useState<LoroDoc | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<SyncStatus>('synced')
  const [invalid, setInvalid] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [agentCursor, setAgentCursor] = useState<AgentCursorPosition | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/document')
      .then(async (res) => {
        const json = (await res.json()) as
          DocumentResponse | { error?: { message?: string } }
        if (!res.ok) {
          throw new Error(
            'error' in json && json.error?.message
              ? json.error.message
              : `load failed (${res.status})`,
          )
        }
        return json as DocumentResponse
      })
      .then((next) => {
        if (cancelled) return
        const loro = new LoroDoc()
        loro.setRecordTimestamp(true)
        loro.setChangeMergeInterval(HUMAN_CHANGE_MERGE_SECONDS)
        loro.import(
          Uint8Array.from(atob(next.snapshot), (c) => c.charCodeAt(0)),
        )
        setMeta(next)
        setInvalid(next.invalid)
        setDoc(loro)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const flush = useCallback(async () => {
    setSaveError(null)
    try {
      const res = await fetch('/api/flush', { method: 'POST' })
      const json = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) {
        throw new Error(json.error?.message ?? `save failed (${res.status})`)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  useEffect(() => {
    if (status === 'synced') return
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [status])

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page text-sm text-red-700 dark:text-red-400">
        {loadError}
      </div>
    )
  }

  if (!meta || !doc) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page text-sm text-fg-muted">
        加载中…
      </div>
    )
  }

  const problem = invalid ? `文件无效，暂停写盘：${invalid}` : saveError

  return (
    <div className="flex h-dvh flex-col bg-surface-page text-fg">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border bg-surface-card px-3">
        <span className="truncate text-sm text-fg-muted">{meta.fileName}</span>
        <span className="shrink-0 text-xs text-fg-subtle">
          {statusLabel[status]}
        </span>
        {problem ? (
          <span className="min-w-0 flex-1 truncate text-sm text-red-700 dark:text-red-400">
            {problem}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          className="rounded-sm px-2.5 py-1 text-sm text-fg-muted hover:bg-surface-inset"
        >
          历史
        </button>
        <button
          type="button"
          onClick={() => void flush()}
          className="rounded-sm bg-accent px-2.5 py-1 text-sm font-medium text-white"
        >
          保存
          <span className="ml-1 text-[10px] font-normal opacity-70">
            {saveLabel}
          </span>
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto">
          <RichEditor
            theme={theme}
            variant={meta.variant}
            extraNodes={extraNodes}
          >
            <DiffNotePlugin />
            <LoroSyncPlugin
              doc={doc}
              onStatus={setStatus}
              onInvalid={setInvalid}
              onAgentCursor={setAgentCursor}
            />
            <SelectionSyncPlugin />
            <AgentCursor cursor={agentCursor} />
          </RichEditor>
        </div>
        {historyOpen ? (
          <HistoryPanel
            theme={theme}
            variant={meta.variant}
            onClose={() => setHistoryOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
