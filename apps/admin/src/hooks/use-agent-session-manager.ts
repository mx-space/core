import type {
  AgentStore,
  AgentStoreSlice,
  ChatBubble,
} from '@haklex/rich-agent-core'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AgentConversation } from '../api/ai-agent'
import {
  createAgentConversation,
  deleteAgentConversation,
  getAgentConversation,
  getAgentConversations,
  replaceAgentConversationMessages,
} from '../api/ai-agent'

export interface AgentSessionMeta {
  id: string
  updatedAt: string
}

interface UseAgentSessionManagerOptions {
  abort: () => void
  getModel: () => string
  getProviderId: () => string
  sessionId?: string
  store: AgentStore
}

function toSessionMeta(conversation: AgentConversation): AgentSessionMeta {
  return {
    id: conversation.id,
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
  sessionId,
  store,
}: UseAgentSessionManagerOptions) {
  const [sessions, setSessions] = useState<AgentSessionMeta[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const activeSessionIdRef = useRef<string | null>(null)
  const abortRef = useRef(abort)
  const getModelRef = useRef(getModel)
  const getProviderIdRef = useRef(getProviderId)
  const isHydratingRef = useRef(false)
  const isCreatingSessionRef = useRef(false)
  const isPendingCreationRef = useRef(false)
  const loadSessionsRef = useRef<() => Promise<void>>(async () => {})
  const sessionIdRef = useRef(sessionId)
  const prevSessionIdRef = useRef(sessionId)
  const sessionEpochRef = useRef(0)
  const sessionsRef = useRef(sessions)
  const pendingSyncRef = useRef<{
    cancel: () => void
    conversationId: string
  } | null>(null)

  useEffect(() => {
    abortRef.current = abort
    getModelRef.current = getModel
    getProviderIdRef.current = getProviderId
    sessionIdRef.current = sessionId
  }, [abort, getModel, getProviderId, sessionId])

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
    (conversationId: string) => {
      const bubbles = store.getState().bubbles
      if (bubbles.length === 0) return

      replaceAgentConversationMessages(
        conversationId,
        bubbles as unknown as Record<string, unknown>[],
      ).catch(() => {})
    },
    [store],
  )

  const flushPendingSync = useCallback(() => {
    const pendingSync = pendingSyncRef.current
    if (!pendingSync) return

    pendingSync.cancel()
    syncMessages(pendingSync.conversationId)
    pendingSyncRef.current = null
  }, [syncMessages])

  const switchSession = useCallback(
    async (conversationId: string) => {
      flushPendingSync()

      const epoch = ++sessionEpochRef.current
      abortRef.current()
      isPendingCreationRef.current = false
      setIsHydrating(true)
      setActiveSessionId(conversationId)
      store.getState().reset()

      try {
        const detail = await getAgentConversation(conversationId)
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

        setSessions((current) =>
          current.map((session) =>
            session.id === conversationId
              ? {
                  ...session,
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
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    setIsLoading(true)
    setLoadError(false)
    try {
      const list = normalizeConversationList(
        await getAgentConversations(currentSessionId),
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
    async (conversationId: string) => {
      if (activeSessionIdRef.current === conversationId) flushPendingSync()

      try {
        await deleteAgentConversation(conversationId)
      } catch {
        return
      }

      const remaining = sessionsRef.current.filter(
        (session) => session.id !== conversationId,
      )
      setSessions(remaining)

      if (activeSessionIdRef.current !== conversationId) return

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
    async (_conversationId: string, _title: string) => {
      // The new session-scoped backend no longer carries a per-conversation
      // title — local rename is a no-op until a dedicated title channel lands.
    },
    [],
  )

  const scheduleMessagesSync = useCallback(
    (conversationId: string) => {
      pendingSyncRef.current?.cancel()

      const timer = setTimeout(() => {
        if (activeSessionIdRef.current === conversationId)
          syncMessages(conversationId)
        pendingSyncRef.current = null
      }, 2000)

      pendingSyncRef.current = {
        cancel: () => clearTimeout(timer),
        conversationId,
      }
    },
    [syncMessages],
  )

  useEffect(() => {
    return store.subscribe((state) => {
      if (isHydratingRef.current) return
      if (state.bubbles.length === 0) return

      const currentSessionId = sessionIdRef.current
      if (!currentSessionId) return

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
          sessionId: currentSessionId,
        })
          .then((conversation) => {
            if (epoch !== sessionEpochRef.current) return
            setActiveSessionId(conversation.id)
            isCreatingSessionRef.current = false
            isPendingCreationRef.current = false
            setSessions((current) => [toSessionMeta(conversation), ...current])
          })
          .catch(() => {
            isCreatingSessionRef.current = false
            isPendingCreationRef.current = false
          })
        return
      }

      scheduleMessagesSync(activeSessionIdRef.current)
    })
  }, [scheduleMessagesSync, store])

  useEffect(() => {
    const previousSessionId = prevSessionIdRef.current
    prevSessionIdRef.current = sessionId

    // Session id only just became available (e.g. a new document acquired its
    // draft id) while an unsaved conversation is already in memory. Keep it so
    // the create path persists it under the new session instead of wiping it.
    const adoptInMemory =
      !previousSessionId &&
      Boolean(sessionId) &&
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

    if (sessionId) void loadSessions()
  }, [flushPendingSync, loadSessions, sessionId, store])

  useEffect(() => {
    return () => {
      flushPendingSync()
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
