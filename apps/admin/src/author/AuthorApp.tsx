import { AgentDiffEditNode } from '@haklex/rich-ext-ai-agent'
import type { SerializedEditorState } from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { RichEditor } from '../vendor/rich-editor/core/RichEditor'
import { DiffNotePlugin } from './DiffNotePlugin'
import { blocksOf, resolveToProposed } from './merge'
import { type RevisionInfo, RevisionSyncPlugin } from './RevisionSyncPlugin'

const extraNodes = [AgentDiffEditNode]

type Variant = 'article' | 'note'

interface DocumentResponse {
  lexical: SerializedEditorState
  variant: Variant
  fileName: string
}

type Theme = 'light' | 'dark'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const saveLabel = isMac ? '⌘S' : 'Ctrl+S'

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
  const [doc, setDoc] = useState<DocumentResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<SerializedEditorState | null>(null)
  const [saved, setSaved] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const hydrated = useRef(false)
  const base = useRef<ReturnType<typeof blocksOf>>([])
  const [revision, setRevision] = useState<RevisionInfo | null>(null)

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
        setDoc(next)
        setState(next.lexical)
        setSaved(JSON.stringify(next.lexical))
        hydrated.current = false
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = useMemo(
    () => state !== null && JSON.stringify(state) !== saved,
    [state, saved],
  )

  const save = useCallback(async () => {
    if (!state) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/document', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lexical: state }),
      })
      const json = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) {
        throw new Error(json.error?.message ?? `save failed (${res.status})`)
      }
      setSaved(JSON.stringify(state))
      base.current = resolveToProposed(blocksOf(state))
      setRevision((prev) => (prev ? { ...prev, conflicts: 0 } : prev))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [state])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  useEffect(() => {
    if (!dirty) return
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page text-sm text-red-700 dark:text-red-400">
        {loadError}
      </div>
    )
  }

  if (!doc || !state) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page text-sm text-fg-muted">
        加载中…
      </div>
    )
  }

  const canSave = (dirty || Boolean(saveError)) && !saving

  return (
    <div className="flex h-dvh flex-col bg-surface-page text-fg">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border bg-surface-card px-3">
        {dirty ? (
          <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        ) : null}
        <span className="truncate text-sm text-fg-muted">{doc.fileName}</span>
        {revision ? (
          <span className="shrink-0 text-xs text-fg-subtle">
            rev {revision.revision}
            {revision.conflicts > 0 ? ` · ${revision.conflicts} 处冲突` : ''}
          </span>
        ) : null}
        {saveError ? (
          <span className="min-w-0 flex-1 truncate text-sm text-red-700 dark:text-red-400">
            {saveError}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="rounded-sm bg-accent px-2.5 py-1 text-sm font-medium text-white disabled:bg-surface-inset disabled:text-fg-subtle"
        >
          {saveError ? '重试' : '保存'}
          <span className="ml-1 text-[10px] font-normal opacity-70">
            {saveLabel}
          </span>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <RichEditor
          theme={theme}
          variant={doc.variant}
          extraNodes={extraNodes}
          initialValue={doc.lexical}
          onChange={(value) => {
            setState(value)
            if (!hydrated.current) {
              hydrated.current = true
              setSaved(JSON.stringify(value))
              base.current = resolveToProposed(blocksOf(value))
              void fetch('/api/baseline', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ lexical: value }),
              })
            }
          }}
        >
          <DiffNotePlugin />
          <RevisionSyncPlugin base={base} onRevision={setRevision} />
        </RichEditor>
      </div>
    </div>
  )
}
