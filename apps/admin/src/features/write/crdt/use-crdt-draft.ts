import type { DocFields, DocFieldsPatch } from '@mx-space/editor/loro'
import type { LexicalEditor } from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDraftCrdt, postDraftCrdt } from '~/api/drafts'

import { type CollabSocket, createCollabChannel } from './collab-channel'
import type { CaretPoint } from './collab-presence'
import {
  type AgentTurn,
  type CrdtDraftSession,
  createCrdtDraftSession,
} from './crdt-draft-session'
import type { CrdtSyncStatus, CrdtTransport } from './crdt-sync'
import { createPeersStore, type PeersSource } from './peers-store'

export type CrdtDraftStatus = CrdtSyncStatus | 'idle' | 'loading'

export interface CrdtDraftController {
  active: boolean
  adoptEditorOnBind: () => void
  bindEditor: (editor: LexicalEditor | null) => void
  fields: () => DocFields | undefined
  flush: () => Promise<void>
  live: () => boolean
  locked: boolean
  peers: PeersSource
  pending: () => boolean
  pull: () => Promise<void>
  resolveCaret: (point: CaretPoint) => { key: string; offset: number } | null
  setFields: (patch: DocFieldsPatch) => void
  setTitle: (title: string) => void
  startAgentTurn: (message: string) => AgentTurn | null
  status: CrdtDraftStatus
}

const LOAD_RETRY_MS = 2000

export interface CrdtDraftRoom {
  author: string
  http: CrdtTransport
  subscribeSocket: (
    listener: (socket: CollabSocket | null) => void,
  ) => () => void
}

export function useCrdtDraft(options: {
  draftId: string
  enabled: boolean
  onRejected: () => Promise<void>
  onRemoteFields?: (fields: DocFields) => void
  onRemoteTitle: (title: string) => void
  onReset?: () => void
  onRevoked?: (reason?: string) => void
  room?: CrdtDraftRoom
}): CrdtDraftController {
  const sessionRef = useRef<CrdtDraftSession | null>(null)
  const editorRef = useRef<LexicalEditor | null>(null)
  const adoptRef = useRef(false)
  const [adopting, setAdopting] = useState(false)
  const [ready, setReady] = useState(false)
  const [peers] = useState(createPeersStore)
  const [status, setStatus] = useState<CrdtDraftStatus>('idle')
  const [generation, setGeneration] = useState(0)
  const [gone, setGone] = useState(false)
  const callbacksRef = useRef(options)
  callbacksRef.current = options
  const enabled = options.enabled && Boolean(options.draftId)

  useEffect(() => {
    setReady(false)
    if (!enabled) {
      setStatus('idle')
      return
    }
    if (gone) {
      setStatus('offline')
      return
    }
    const draftId = options.draftId
    let disposed = false
    let session: CrdtDraftSession | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let stopPeers: (() => void) | undefined
    setStatus('loading')
    const { room } = callbacksRef.current
    void createCrdtDraftSession({
      author: room?.author,
      channel: (hooks) =>
        createCollabChannel({
          ...hooks,
          draftId,
          http: room?.http ?? {
            pull: (since) => getDraftCrdt(draftId, since),
            push: (bytes) => postDraftCrdt(draftId, bytes),
          },
          subscribeSocket: room?.subscribeSocket,
        }),
      onRejected: () => {
        void callbacksRef.current
          .onRejected()
          .finally(() => setGeneration((value) => value + 1))
      },
      onRemoteFields: (fields) => callbacksRef.current.onRemoteFields?.(fields),
      onRemoteTitle: (title) => callbacksRef.current.onRemoteTitle(title),
      onReset: () => {
        if (disposed) return
        callbacksRef.current.onReset?.()
        setGeneration((value) => value + 1)
      },
      onRevoked: (reason) => {
        if (disposed) return
        if (reason === 'deleted') setGone(true)
        callbacksRef.current.onRevoked?.(reason)
      },
      presence: true,
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
  }, [enabled, generation, gone, options.draftId, peers])

  useEffect(() => {
    setGone(false)
  }, [options.draftId])

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
      fields: () => sessionRef.current?.fields(),
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
      setFields: (patch: DocFieldsPatch) =>
        sessionRef.current?.setFields(patch),
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
