import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentStore,
  AgentStoreSlice,
  ChatBubble,
  DiffState,
  ReviewState,
} from '@haklex/rich-agent-core'
import type { AgentConversation } from '../api/ai-agent'

import {
  createAgentConversation,
  deleteAgentConversation,
  getAgentConversation,
  getAgentConversations,
  replaceAgentConversationMessages,
  updateAgentConversation,
} from '../api/ai-agent'

export interface AgentSessionMeta {
  id: string
  messageCount: number
  title?: string
  updatedAt: string
}

interface UseAgentSessionManagerOptions {
  abort: () => void
  getModel: () => string
  getProviderId: () => string
  refId?: string
  refType: 'note' | 'page' | 'post'
  store: AgentStore
}

function toSessionMeta(conversation: AgentConversation): AgentSessionMeta {
  return {
    id: conversation.id,
    messageCount:
      conversation.messageCount ?? conversation.messages?.length ?? 0,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
  }
}

function normalizeConversationList(value: AgentConversation[] | unknown) {
  if (Array.isArray(value)) return value
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: AgentConversation[] }).data
  }

  return []
}

function normalizeHydratedBubble(message: Record<string, unknown>) {
  const bubble = { ...message }
  if ('streaming' in bubble) bubble.streaming = false
  if ('isStreaming' in bubble) bubble.isStreaming = false
  return bubble as unknown as ChatBubble
}

export function useAgentSessionManager({
  abort,
  getModel,
  getProviderId,
  refId,
  refType,
  store,
}: UseAgentSessionManagerOptions) {
  const [sessions, setSessions] = useState<AgentSessionMeta[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const activeSessionIdRef = useRef<string | null>(null)
  const abortRef = useRef(abort)
  const diffSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getModelRef = useRef(getModel)
  const getProviderIdRef = useRef(getProviderId)
  const isHydratingRef = useRef(false)
  const isCreatingSessionRef = useRef(false)
  const isPendingCreationRef = useRef(false)
  const loadSessionsRef = useRef<() => Promise<void>>(async () => {})
  const refIdRef = useRef(refId)
  const prevRefIdRef = useRef(refId)
  const refTypeRef = useRef(refType)
  const sessionEpochRef = useRef(0)
  const sessionsRef = useRef(sessions)
  const titlePollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSyncRef = useRef<{
    cancel: () => void
    sessionId: string
  } | null>(null)

  useEffect(() => {
    abortRef.current = abort
    getModelRef.current = getModel
    getProviderIdRef.current = getProviderId
    refIdRef.current = refId
    refTypeRef.current = refType
  }, [abort, getModel, getProviderId, refId, refType])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    isHydratingRef.current = isHydrating
  }, [isHydrating])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  const syncMessages = useCallback(
    (sessionId: string) => {
      const bubbles = store.getState().bubbles
      if (bubbles.length === 0) return

      replaceAgentConversationMessages(
        sessionId,
        bubbles as unknown as Record<string, unknown>[],
      )
        .then(() => {
          const meta = sessionsRef.current.find(
            (session) => session.id === sessionId,
          )
          if (!meta || meta.title || titlePollTimerRef.current) return

          titlePollTimerRef.current = setTimeout(() => {
            titlePollTimerRef.current = null
            void loadSessionsRef.current()
          }, 6000)
        })
        .catch(() => {})
    },
    [store],
  )

  const flushPendingSync = useCallback(() => {
    const pendingSync = pendingSyncRef.current
    if (!pendingSync) return

    pendingSync.cancel()
    syncMessages(pendingSync.sessionId)
    pendingSyncRef.current = null
  }, [syncMessages])

  const switchSession = useCallback(
    async (sessionId: string) => {
      flushPendingSync()

      const epoch = ++sessionEpochRef.current
      abortRef.current()
      isPendingCreationRef.current = false
      setIsHydrating(true)
      setActiveSessionId(sessionId)
      store.getState().reset()

      try {
        const detail = await getAgentConversation(sessionId)
        if (epoch !== sessionEpochRef.current) return

        const messages = detail.messages ?? []
        const bubbles = messages
          .filter((message): message is Record<string, unknown> => {
            const type = message.type ?? message.role
            return typeof type === 'string' && type.length > 0
          })
          .map(normalizeHydratedBubble)

        store.setState({
          bubbles,
          status: 'idle',
        } as Partial<AgentStoreSlice>)

        if (detail.reviewState) {
          store
            .getState()
            .setReviewState(detail.reviewState as unknown as ReviewState)
        }
        if (detail.diffState) {
          store
            .getState()
            .setDiffState(detail.diffState as unknown as DiffState)
        }

        setSessions((current) =>
          current.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messageCount: bubbles.length,
                  title: detail.title,
                  updatedAt: detail.updatedAt,
                }
              : session,
          ),
        )
      } catch {
        store.setState({
          bubbles: [],
          status: 'idle',
        } as Partial<AgentStoreSlice>)
      } finally {
        if (epoch === sessionEpochRef.current) setIsHydrating(false)
      }
    },
    [flushPendingSync, store],
  )

  const loadSessions = useCallback(async () => {
    const currentRefId = refIdRef.current
    if (!currentRefId) return

    setIsLoading(true)
    setLoadError(false)
    try {
      const list = normalizeConversationList(
        await getAgentConversations(currentRefId, refTypeRef.current),
      )
      const metas = list.map(toSessionMeta)
      setSessions(metas)

      if (metas.length > 0 && !activeSessionIdRef.current) {
        await switchSession(metas[0].id)
      }
    } catch {
      setSessions([])
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [switchSession])

  useEffect(() => {
    loadSessionsRef.current = loadSessions
  }, [loadSessions])

  const createSession = useCallback(() => {
    flushPendingSync()
    abortRef.current()
    store.getState().reset()
    setActiveSessionId(null)
    isCreatingSessionRef.current = false
    isPendingCreationRef.current = true
    sessionEpochRef.current += 1
  }, [flushPendingSync, store])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (activeSessionIdRef.current === sessionId) flushPendingSync()

      try {
        await deleteAgentConversation(sessionId)
      } catch {
        return
      }

      const remaining = sessionsRef.current.filter(
        (session) => session.id !== sessionId,
      )
      setSessions(remaining)

      if (activeSessionIdRef.current !== sessionId) return

      if (remaining.length > 0) {
        await switchSession(remaining[0].id)
        return
      }

      setActiveSessionId(null)
      isCreatingSessionRef.current = false
      isPendingCreationRef.current = false
      store.getState().reset()
      sessionEpochRef.current += 1
    },
    [flushPendingSync, store, switchSession],
  )

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return

      try {
        await updateAgentConversation(sessionId, { title: trimmed })
        setSessions((current) =>
          current.map((session) =>
            session.id === sessionId ? { ...session, title: trimmed } : session,
          ),
        )
      } catch {}
    },
    [],
  )

  const scheduleMessagesSync = useCallback(
    (sessionId: string) => {
      pendingSyncRef.current?.cancel()

      const timer = setTimeout(() => {
        if (activeSessionIdRef.current === sessionId) syncMessages(sessionId)
        pendingSyncRef.current = null
      }, 2000)

      pendingSyncRef.current = {
        cancel: () => clearTimeout(timer),
        sessionId,
      }
    },
    [syncMessages],
  )

  const scheduleDiffSync = useCallback(() => {
    if (diffSyncTimerRef.current) clearTimeout(diffSyncTimerRef.current)

    const sessionId = activeSessionIdRef.current
    if (!sessionId) return

    diffSyncTimerRef.current = setTimeout(() => {
      if (activeSessionIdRef.current !== sessionId) return
      const state = store.getState()
      updateAgentConversation(sessionId, {
        diffState:
          (state.diffState as unknown as Record<string, unknown>) ?? null,
        reviewState:
          (state.reviewState as unknown as Record<string, unknown>) ?? null,
      }).catch(() => {})
    }, 2000)
  }, [store])

  useEffect(() => {
    return store.subscribe((state) => {
      if (isHydratingRef.current) return
      if (state.bubbles.length === 0) return

      const currentRefId = refIdRef.current
      if (!currentRefId) return

      const epoch = sessionEpochRef.current
      const messages = state.bubbles as unknown as Record<string, unknown>[]

      if (!activeSessionIdRef.current) {
        if (isCreatingSessionRef.current) return

        isCreatingSessionRef.current = true
        isPendingCreationRef.current = true
        createAgentConversation({
          messages,
          model: getModelRef.current(),
          providerId: getProviderIdRef.current(),
          refId: currentRefId,
          refType: refTypeRef.current,
        })
          .then((conversation) => {
            if (epoch !== sessionEpochRef.current) return
            setActiveSessionId(conversation.id)
            isCreatingSessionRef.current = false
            isPendingCreationRef.current = false
            setSessions((current) => [toSessionMeta(conversation), ...current])
            setTimeout(() => void loadSessionsRef.current(), 5000)
          })
          .catch(() => {
            isCreatingSessionRef.current = false
            isPendingCreationRef.current = false
          })
        return
      }

      scheduleMessagesSync(activeSessionIdRef.current)
      scheduleDiffSync()
    })
  }, [scheduleDiffSync, scheduleMessagesSync, store])

  useEffect(() => {
    const previousRefId = prevRefIdRef.current
    prevRefIdRef.current = refId

    // refId only just became available (e.g. a new document acquired its draft
    // id) while an unsaved conversation is already in memory. Keep it so the
    // create path persists it under the new ref instead of wiping it.
    const adoptInMemory =
      !previousRefId &&
      Boolean(refId) &&
      !activeSessionIdRef.current &&
      store.getState().bubbles.length > 0
    if (adoptInMemory) return

    flushPendingSync()
    sessionsRef.current = []
    setSessions([])
    setActiveSessionId(null)
    isCreatingSessionRef.current = false
    isPendingCreationRef.current = false
    store.getState().reset()
    sessionEpochRef.current += 1

    if (refId) void loadSessions()
  }, [flushPendingSync, loadSessions, refId, store])

  useEffect(() => {
    return () => {
      flushPendingSync()
      if (diffSyncTimerRef.current) clearTimeout(diffSyncTimerRef.current)
      if (titlePollTimerRef.current) clearTimeout(titlePollTimerRef.current)
    }
  }, [flushPendingSync])

  return {
    activeSessionId,
    createSession,
    deleteSession,
    isHydrating,
    isLoading,
    loadError,
    loadSessions,
    renameSession,
    sessions,
    switchSession,
  }
}
