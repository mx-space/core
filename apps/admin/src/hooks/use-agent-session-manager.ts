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
  generateAgentConversationTitle,
  getAgentConversation,
  getAgentConversations,
  replaceAgentConversationMessages,
} from '../api/ai-agent'
import { buildTitleProjection } from '../features/agent-core/message-normalizer'
import type { PersistenceQueue } from '../features/agent-core/persistence-queue'
import { createPersistenceQueue } from '../features/agent-core/persistence-queue'

export interface AgentSessionMeta {
  id: string
  createdAt: string
  updatedAt: string
  title: string | null
  derivedTitle: string | null
}

interface UseAgentSessionManagerOptions {
  abort: () => void
  getModel: () => string
  getProviderId: () => string
  sessionId?: string
  store: AgentStore
}

const TITLE_MAX_CHARS = 28

function deriveTitleFromMessages(
  messages: AgentConversation['messages'],
): string | null {
  if (!messages?.length) return null
  for (const m of messages) {
    if ((m as { type?: string }).type === 'user') {
      const content = String((m as { content?: unknown }).content ?? '').trim()
      if (!content) continue
      const oneLine = content.replaceAll(/\s+/g, ' ')
      return oneLine.length > TITLE_MAX_CHARS
        ? `${oneLine.slice(0, TITLE_MAX_CHARS)}…`
        : oneLine
    }
    if ((m as { role?: string }).role === 'user') {
      const content = String((m as { content?: unknown }).content ?? '').trim()
      if (!content) continue
      const oneLine = content.replaceAll(/\s+/g, ' ')
      return oneLine.length > TITLE_MAX_CHARS
        ? `${oneLine.slice(0, TITLE_MAX_CHARS)}…`
        : oneLine
    }
  }
  return null
}

function toSessionMeta(conversation: AgentConversation): AgentSessionMeta {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    title: conversation.title,
    derivedTitle: deriveTitleFromMessages(conversation.messages),
  }
}

function shouldTriggerTitleGen(
  bubbles: { type?: string }[],
  meta: AgentSessionMeta | undefined,
): boolean {
  if (!meta || meta.title) return false
  const hasUser = bubbles.some((b) => b.type === 'user')
  const hasAssistant = bubbles.some((b) => b.type === 'assistant')
  return hasUser && hasAssistant
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

// Sentinel envelope: review state batches are NOT bubbles, they live on
// store.reviewState — but the server's `messages` column is the only piece we
// persist. Append a sentinel message at the tail on save; extract it on hydrate.
const REVIEW_STATE_SENTINEL = '__agent_review_state__'

type AgentStoreReviewState = AgentStoreSlice['reviewState']

function withEmbeddedReviewState(
  bubbles: Record<string, unknown>[],
  reviewState: AgentStoreReviewState,
): Record<string, unknown>[] {
  if (!reviewState || reviewState.batches.length === 0) return bubbles
  return [
    ...bubbles,
    {
      type: REVIEW_STATE_SENTINEL,
      reviewState: reviewState as unknown as Record<string, unknown>,
    },
  ]
}

function splitMessagesEnvelope(messages: Record<string, unknown>[]): {
  bubbles: Record<string, unknown>[]
  reviewState: AgentStoreReviewState
} {
  let reviewState: AgentStoreReviewState = null
  const bubbles: Record<string, unknown>[] = []
  for (const message of messages) {
    if (message && message.type === REVIEW_STATE_SENTINEL) {
      const payload = (message as { reviewState?: unknown }).reviewState
      if (payload && typeof payload === 'object') {
        reviewState = payload as AgentStoreReviewState
      }
      continue
    }
    bubbles.push(message)
  }
  return { bubbles, reviewState }
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
  const saveQueuesRef = useRef(
    new Map<
      string,
      PersistenceQueue<Record<string, unknown>[], AgentConversation>
    >(),
  )

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

  const getSaveQueue = useCallback((conversationId: string) => {
    const existing = saveQueuesRef.current.get(conversationId)
    if (existing) return existing

    const queue = createPersistenceQueue<
      Record<string, unknown>[],
      AgentConversation
    >({
      save: (messages) =>
        replaceAgentConversationMessages(conversationId, messages),
    })
    saveQueuesRef.current.set(conversationId, queue)
    return queue
  }, [])

  const syncMessages = useCallback(
    async (conversationId: string) => {
      const state = store.getState()
      const bubbles = state.bubbles
      if (bubbles.length === 0) return null

      const messages = withEmbeddedReviewState(
        bubbles as unknown as Record<string, unknown>[],
        state.reviewState,
      )

      return getSaveQueue(conversationId)
        .enqueue(messages)
        .then((updated) => {
          if (!updated) return
          const meta = toSessionMeta(updated)
          setSessions((current) =>
            current.map((session) =>
              session.id === conversationId ? meta : session,
            ),
          )

          if (
            shouldTriggerTitleGen(
              bubbles as unknown as { type?: string }[],
              meta,
            )
          ) {
            generateAgentConversationTitle(conversationId, {
              messages: buildTitleProjection(messages),
              model: getModelRef.current(),
              providerId: getProviderIdRef.current(),
            })
              .then((withTitle) => {
                if (!withTitle?.title) return
                const next = toSessionMeta(withTitle)
                setSessions((current) =>
                  current.map((session) =>
                    session.id === conversationId ? next : session,
                  ),
                )
              })
              .catch(() => {})
          }
          return updated
        })
        .catch(() => null)
    },
    [getSaveQueue, store],
  )

  const flushPendingSync = useCallback(async () => {
    const pendingSync = pendingSyncRef.current
    if (!pendingSync) return null

    pendingSync.cancel()
    pendingSyncRef.current = null
    return syncMessages(pendingSync.conversationId)
  }, [syncMessages])

  const switchSession = useCallback(
    async (conversationId: string) => {
      await flushPendingSync()

      const epoch = ++sessionEpochRef.current
      abortRef.current()
      isPendingCreationRef.current = false
      setIsHydrating(true)
      setActiveSessionId(conversationId)
      store.getState().reset()

      try {
        const detail = await getAgentConversation(conversationId)
        if (epoch !== sessionEpochRef.current) return

        const rawMessages = detail.messages ?? []
        const { bubbles: bubbleMessages, reviewState } =
          splitMessagesEnvelope(rawMessages)
        const bubbles = bubbleMessages
          .filter((message): message is Record<string, unknown> => {
            const type = message.type ?? message.role
            return typeof type === 'string' && type.length > 0
          })
          .map(normalizeHydratedBubble)

        store.setState({
          bubbles,
          reviewState,
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
    void flushPendingSync()
    abortRef.current()
    store.getState().reset()
    setActiveSessionId(null)
    isCreatingSessionRef.current = false
    isPendingCreationRef.current = true
    sessionEpochRef.current += 1
  }, [flushPendingSync, store])

  const deleteSession = useCallback(
    async (conversationId: string) => {
      if (activeSessionIdRef.current === conversationId) {
        await flushPendingSync()
      }

      try {
        await deleteAgentConversation(conversationId)
      } catch {
        return
      }
      saveQueuesRef.current.delete(conversationId)

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
          void syncMessages(conversationId)
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
      const messages = withEmbeddedReviewState(
        state.bubbles as unknown as Record<string, unknown>[],
        state.reviewState,
      )

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

    void flushPendingSync()
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
      void flushPendingSync()
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
