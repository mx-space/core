import type {
  AgentStore,
  AgentStoreSlice,
  ChatBubble,
} from '@haklex/rich-agent-core'
import type { AgentHistoryBubble } from '@mx-space/ai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  ChatAttachment,
  UserChatBubble,
} from '~/features/write/components/agent/types'
import { translate } from '~/i18n/translate'

import type { AgentConversation, AgentReviewAnchor } from '../api/ai-agent'
import {
  deleteAgentConversation,
  generateAgentConversationTitle,
  getAgentConversation,
  getAgentConversations,
  saveAgentConversationReviewState,
  updateAgentConversation,
} from '../api/ai-agent'

export interface AgentSessionMeta {
  id: string
  createdAt: string
  updatedAt: string
  title: string | null
  derivedTitle: string | null
}

interface UseAgentSessionManagerOptions {
  abort: () => void
  describeToolCall?: (
    toolName: string,
    params: Record<string, unknown>,
  ) => string | undefined
  sessionId?: string
  store: AgentStore
}

type AgentStoreReviewState = AgentStoreSlice['reviewState']

const TITLE_MAX_CHARS = 28
const REVIEW_SYNC_DELAY_MS = 1000

function deriveTitle(bubbles: readonly ChatBubble[]): string | null {
  const first = bubbles.find((bubble) => bubble.type === 'user')
  const content = first?.type === 'user' ? first.content.trim() : ''
  if (!content) return null
  const oneLine = content.replaceAll(/\s+/g, ' ')
  return oneLine.length > TITLE_MAX_CHARS
    ? `${oneLine.slice(0, TITLE_MAX_CHARS)}…`
    : oneLine
}

function toSessionMeta(conversation: AgentConversation): AgentSessionMeta {
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt ?? conversation.createdAt,
    title: conversation.title,
    derivedTitle: null,
  }
}

function normalizeConversationList(value: AgentConversation[] | unknown) {
  if (Array.isArray(value)) return value as AgentConversation[]
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

export function useAgentSessionManager({
  abort,
  describeToolCall,
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
  const describeRef = useRef(describeToolCall)
  const isHydratingRef = useRef(false)
  const sessionIdRef = useRef(sessionId)
  const prevSessionIdRef = useRef(sessionId)
  const initializedRef = useRef(false)
  const sessionEpochRef = useRef(0)
  const sessionsRef = useRef(sessions)
  const anchorsRef = useRef(new Map<string, string>())
  const titledRef = useRef(new Set<string>())
  const pendingReviewSyncRef = useRef<{
    conversationId: string
    flush: () => void
    cancel: () => void
  } | null>(null)

  abortRef.current = abort
  describeRef.current = describeToolCall
  sessionIdRef.current = sessionId

  const activate = useCallback((conversationId: string | null) => {
    activeSessionIdRef.current = conversationId
    setActiveSessionId(conversationId)
  }, [])

  const replaceSessions = useCallback((next: AgentSessionMeta[]) => {
    sessionsRef.current = next
    setSessions(next)
  }, [])

  const updateSessions = useCallback(
    (update: (current: AgentSessionMeta[]) => AgentSessionMeta[]) => {
      replaceSessions(update(sessionsRef.current))
    },
    [replaceSessions],
  )

  const syncReviewState = useCallback(
    (conversationId: string, reviewState: AgentStoreReviewState) => {
      const batchIds = new Set(reviewState?.batches.map((batch) => batch.id))
      const anchors: AgentReviewAnchor[] = [...anchorsRef.current]
        .filter(([batchId]) => batchIds.has(batchId))
        .map(([batchId, toolCallId]) => ({ batchId, toolCallId }))
      saveAgentConversationReviewState(conversationId, {
        anchors,
        reviewState: reviewState as unknown as Record<string, unknown> | null,
      }).catch(() => {
        toast.error(translate('write.agent.toast.sessionSyncFailed'))
      })
    },
    [],
  )

  const flushPendingSync = useCallback(() => {
    pendingReviewSyncRef.current?.flush()
    pendingReviewSyncRef.current = null
  }, [])

  const resetConversation = useCallback(() => {
    flushPendingSync()
    abortRef.current()
    activate(null)
    store.getState().reset()
    anchorsRef.current = new Map()
    sessionEpochRef.current += 1
  }, [activate, flushPendingSync, store])

  const switchSession = useCallback(
    async (conversationId: string) => {
      resetConversation()
      const epoch = sessionEpochRef.current
      activate(conversationId)
      isHydratingRef.current = true
      setIsHydrating(true)

      try {
        const detail = await getAgentConversation(conversationId)
        if (epoch !== sessionEpochRef.current) return

        anchorsRef.current = new Map(
          (detail.anchors ?? []).map(({ batchId, toolCallId }) => [
            batchId,
            toolCallId,
          ]),
        )
        store.setState({
          bubbles: (detail.bubbles ?? []).map((bubble) =>
            hydrateBubble(bubble, describeRef.current),
          ),
          reviewState: detail.reviewState as AgentStoreReviewState,
          status: 'idle',
        } as Partial<AgentStoreSlice>)
        if (detail.title) titledRef.current.add(conversationId)
      } catch {
        store.setState({
          bubbles: [],
          status: 'idle',
        } as Partial<AgentStoreSlice>)
      } finally {
        if (epoch === sessionEpochRef.current) {
          isHydratingRef.current = false
          setIsHydrating(false)
        }
      }
    },
    [activate, resetConversation, store],
  )

  const loadSessions = useCallback(async () => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    setIsLoading(true)
    setLoadError(false)
    try {
      const metas = normalizeConversationList(
        await getAgentConversations(currentSessionId),
      ).map(toSessionMeta)
      replaceSessions(metas)
      if (metas.length > 0 && !activeSessionIdRef.current) {
        await switchSession(metas[0].id)
      }
    } catch {
      replaceSessions([])
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [replaceSessions, switchSession])

  const adoptConversation = useCallback(
    (conversationId: string) => {
      if (activeSessionIdRef.current === conversationId) return
      activate(conversationId)
      const now = new Date().toISOString()
      updateSessions((current) => [
        {
          createdAt: now,
          derivedTitle: deriveTitle(store.getState().bubbles),
          id: conversationId,
          title: null,
          updatedAt: now,
        },
        ...current.filter((session) => session.id !== conversationId),
      ])
    },
    [activate, store, updateSessions],
  )

  const recordAnchor = useCallback((batchId: string, toolCallId: string) => {
    anchorsRef.current.set(batchId, toolCallId)
  }, [])

  const onRunFinished = useCallback(async () => {
    const conversationId = activeSessionIdRef.current
    if (!conversationId || titledRef.current.has(conversationId)) return
    titledRef.current.add(conversationId)
    try {
      const updated = await generateAgentConversationTitle(conversationId)
      if (!updated?.title) {
        titledRef.current.delete(conversationId)
        return
      }
      updateSessions((current) =>
        current.map((session) =>
          session.id === conversationId
            ? { ...session, title: updated.title }
            : session,
        ),
      )
    } catch {
      titledRef.current.delete(conversationId)
    }
  }, [updateSessions])

  const createSession = useCallback(() => {
    resetConversation()
  }, [resetConversation])

  const deleteSession = useCallback(
    async (conversationId: string) => {
      try {
        await deleteAgentConversation(conversationId)
      } catch {
        return
      }
      const remaining = sessionsRef.current.filter(
        (session) => session.id !== conversationId,
      )
      replaceSessions(remaining)
      if (activeSessionIdRef.current !== conversationId) return
      if (remaining.length > 0) {
        await switchSession(remaining[0].id)
        return
      }
      resetConversation()
    },
    [replaceSessions, resetConversation, switchSession],
  )

  const renameSession = useCallback(
    async (_conversationId: string, _title: string) => {},
    [],
  )

  useEffect(() => {
    let previous = store.getState().reviewState
    return store.subscribe((state) => {
      if (state.reviewState === previous) return
      previous = state.reviewState
      const conversationId = activeSessionIdRef.current
      if (isHydratingRef.current || !conversationId) return

      pendingReviewSyncRef.current?.cancel()
      const reviewState = state.reviewState
      const flush = () => {
        clearTimeout(timer)
        syncReviewState(conversationId, reviewState)
      }
      const timer = setTimeout(() => {
        pendingReviewSyncRef.current = null
        syncReviewState(conversationId, reviewState)
      }, REVIEW_SYNC_DELAY_MS)
      pendingReviewSyncRef.current = {
        cancel: () => clearTimeout(timer),
        conversationId,
        flush,
      }
    })
  }, [store, syncReviewState])

  useEffect(() => {
    const previousSessionId = prevSessionIdRef.current
    const firstRun = !initializedRef.current
    initializedRef.current = true
    prevSessionIdRef.current = sessionId
    if (!firstRun && previousSessionId === sessionId) return

    const conversationId = activeSessionIdRef.current
    if (!firstRun && !previousSessionId && sessionId && conversationId) {
      void updateAgentConversation(conversationId, { sessionId }).catch(() => {
        toast.error(translate('write.agent.toast.sessionSyncFailed'))
      })
      return
    }

    resetConversation()
    replaceSessions([])
    if (sessionId) void loadSessions()
  }, [loadSessions, replaceSessions, resetConversation, sessionId])

  useEffect(() => () => flushPendingSync(), [flushPendingSync])

  const getActiveConversationId = useCallback(
    () => activeSessionIdRef.current,
    [],
  )

  return {
    activeSessionId,
    adoptConversation,
    createSession,
    deleteSession,
    getActiveConversationId,
    isHydrating,
    isLoading,
    loadError,
    loadSessions,
    onRunFinished,
    recordAnchor,
    renameSession,
    sessions,
    switchSession,
  }
}

const basename = (path: string) =>
  decodeURIComponent(path.split(/[?#]/)[0].split('/').pop() || path)

function hydrateUserBubble(
  bubble: Extract<AgentHistoryBubble, { type: 'user' }>,
): ChatBubble {
  const { files, images, ...rest } = bubble
  const attachments: ChatAttachment[] = [
    ...(images ?? []).map((image) => ({
      kind: 'image' as const,
      name: basename(image.url),
      url: image.url,
    })),
    ...(files ?? []).map((path) => ({
      kind: 'file' as const,
      name: basename(path),
    })),
  ]
  const user: UserChatBubble = attachments.length
    ? { ...rest, attachments }
    : rest
  return user
}

function hydrateBubble(
  bubble: AgentHistoryBubble,
  describe: UseAgentSessionManagerOptions['describeToolCall'],
): ChatBubble {
  if (bubble.type === 'user') return hydrateUserBubble(bubble)
  if (bubble.type !== 'tool_call_group') return bubble as ChatBubble
  return {
    ...bubble,
    items: bubble.items.map((item) => ({
      ...item,
      description: describe?.(item.toolName, item.params),
    })),
  } as ChatBubble
}
