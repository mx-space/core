import type { LexicalEditor } from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDraftCrdt, postDraftCrdt } from '~/api/drafts'

import {
  type CrdtDraftSession,
  createCrdtDraftSession,
} from './crdt-draft-session'
import type { CrdtSyncStatus } from './crdt-sync'

export type CrdtDraftStatus = CrdtSyncStatus | 'idle' | 'loading'

export interface CrdtDraftController {
  active: boolean
  adoptEditorOnBind: () => void
  bindEditor: (editor: LexicalEditor | null) => void
  flush: () => Promise<void>
  locked: boolean
  pending: () => boolean
  pull: () => Promise<void>
  setCommitMessage: (message: string | null) => void
  setTitle: (title: string) => void
  status: CrdtDraftStatus
}

const LOAD_RETRY_MS = 2000

export function useCrdtDraft(options: {
  draftId: string
  enabled: boolean
  onRejected: () => Promise<void>
  onRemoteTitle: (title: string) => void
}): CrdtDraftController {
  const sessionRef = useRef<CrdtDraftSession | null>(null)
  const editorRef = useRef<LexicalEditor | null>(null)
  const adoptRef = useRef(false)
  const [adopting, setAdopting] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<CrdtDraftStatus>('idle')
  const [generation, setGeneration] = useState(0)
  const callbacksRef = useRef(options)
  callbacksRef.current = options
  const enabled = options.enabled && Boolean(options.draftId)

  useEffect(() => {
    setReady(false)
    if (!enabled) {
      setStatus('idle')
      return
    }
    const draftId = options.draftId
    let disposed = false
    let session: CrdtDraftSession | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    setStatus('loading')
    void createCrdtDraftSession({
      onRejected: () => {
        void callbacksRef.current
          .onRejected()
          .finally(() => setGeneration((value) => value + 1))
      },
      onRemoteTitle: (title) => callbacksRef.current.onRemoteTitle(title),
      onStatus: (next) => {
        if (!disposed) setStatus(next)
      },
      transport: {
        pull: (since) => getDraftCrdt(draftId, since),
        push: (bytes) => postDraftCrdt(draftId, bytes),
      },
    })
      .then((created) => {
        if (disposed) {
          created.dispose()
          return
        }
        session = created
        sessionRef.current = created
        created.bindEditor(editorRef.current, { adopt: adoptRef.current })
        if (editorRef.current) {
          adoptRef.current = false
          setAdopting(false)
        }
        setStatus('synced')
        setReady(true)
      })
      .catch(() => {
        if (disposed) return
        setStatus('offline')
        retry = setTimeout(
          () => setGeneration((value) => value + 1),
          LOAD_RETRY_MS,
        )
      })
    return () => {
      disposed = true
      clearTimeout(retry)
      session?.dispose()
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [enabled, generation, options.draftId])

  const bindEditor = useCallback((editor: LexicalEditor | null) => {
    editorRef.current = editor
    if (!sessionRef.current) return
    sessionRef.current.bindEditor(editor, { adopt: adoptRef.current })
    if (editor) {
      adoptRef.current = false
      setAdopting(false)
    }
  }, [])

  const actions = useMemo(
    () => ({
      adoptEditorOnBind: () => {
        adoptRef.current = true
        setAdopting(true)
      },
      flush: async () => {
        await sessionRef.current?.flush()
      },
      pending: () => sessionRef.current?.pending() ?? false,
      pull: async () => {
        await sessionRef.current?.pull()
      },
      setCommitMessage: (message: string | null) =>
        sessionRef.current?.setCommitMessage(message),
      setTitle: (title: string) => sessionRef.current?.setTitle(title),
    }),
    [],
  )

  const active = enabled && ready
  return {
    ...actions,
    active,
    bindEditor,
    locked: enabled && !active && !adopting,
    status,
  }
}
