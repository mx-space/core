import type { LexicalEditor } from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDraftCrdt, postDraftCrdt } from '~/api/drafts'

import { createCollabChannel } from './collab-channel'
import type { CaretPoint, PresenceUser } from './collab-presence'
import {
  type AgentTurn,
  type CrdtDraftSession,
  createCrdtDraftSession,
} from './crdt-draft-session'
import type { CrdtSyncStatus } from './crdt-sync'
import { createPeersStore, type PeersSource } from './peers-store'

export type CrdtDraftStatus = CrdtSyncStatus | 'idle' | 'loading'

export interface CrdtDraftController {
  active: boolean
  adoptEditorOnBind: () => void
  bindEditor: (editor: LexicalEditor | null) => void
  flush: () => Promise<void>
  live: () => boolean
  locked: boolean
  peers: PeersSource
  pending: () => boolean
  pull: () => Promise<void>
  resolveCaret: (point: CaretPoint) => { key: string; offset: number } | null
  setTitle: (title: string) => void
  startAgentTurn: (message: string) => AgentTurn | null
  status: CrdtDraftStatus
}

const LOAD_RETRY_MS = 2000
const FALLBACK_USER: PresenceUser = { avatar: null, id: 'owner', name: '' }

export function useCrdtDraft(options: {
  draftId: string
  enabled: boolean
  onRejected: () => Promise<void>
  onRemoteTitle: (title: string) => void
  user?: PresenceUser
}): CrdtDraftController {
  const sessionRef = useRef<CrdtDraftSession | null>(null)
  const editorRef = useRef<LexicalEditor | null>(null)
  const adoptRef = useRef(false)
  const [adopting, setAdopting] = useState(false)
  const [ready, setReady] = useState(false)
  const [peers] = useState(createPeersStore)
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
    let stopPeers: (() => void) | undefined
    setStatus('loading')
    void createCrdtDraftSession({
      channel: (hooks) =>
        createCollabChannel({
          ...hooks,
          draftId,
          http: {
            pull: (since) => getDraftCrdt(draftId, since),
            push: (bytes) => postDraftCrdt(draftId, bytes),
          },
        }),
      onRejected: () => {
        void callbacksRef.current
          .onRejected()
          .finally(() => setGeneration((value) => value + 1))
      },
      onRemoteTitle: (title) => callbacksRef.current.onRemoteTitle(title),
      presence: {
        user: () => callbacksRef.current.user ?? FALLBACK_USER,
      },
      onStatus: (next) => {
        if (!disposed) setStatus(next)
      },
    })
      .then((created) => {
        if (disposed) {
          created.dispose()
          return
        }
        session = created
        sessionRef.current = created
        stopPeers = created.subscribePeers(peers.set)
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
      stopPeers?.()
      peers.set([])
      session?.dispose()
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [enabled, generation, options.draftId, peers])

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
      live: () => sessionRef.current?.live() ?? false,
      pending: () => sessionRef.current?.pending() ?? false,
      resolveCaret: (point: CaretPoint) =>
        sessionRef.current?.resolveCaret(point) ?? null,
      pull: async () => {
        await sessionRef.current?.pull()
      },
      setTitle: (title: string) => sessionRef.current?.setTitle(title),
      startAgentTurn: (message: string) =>
        sessionRef.current?.startAgentTurn(message) ?? null,
    }),
    [],
  )

  const active = enabled && ready
  return {
    ...actions,
    active,
    bindEditor,
    locked: enabled && !active && !adopting,
    peers,
    status,
  }
}
