import type {
  AIAgentMessage,
  AIAgentRuntimeConfig,
  AIAgentSession,
  WsConfirmRequest,
  WsConfirmResult,
  WsMessagePayload,
  WsSessionState,
  WsToolEvent,
} from '@/types/agent'
import { useCallback } from 'react'
import { create } from 'zustand'
import { api } from './api'

// ──────────────── Tool Event Entry ────────────────

export interface ToolEventEntry {
  toolUseId: string
  toolName: string
  status: 'running' | 'done' | 'error'
  input?: unknown
  output?: unknown
  error?: string
}

// ──────────────── State ────────────────

export interface AgentState {
  config: AIAgentRuntimeConfig | null
  sessions: AIAgentSession[]
  activeSessionId: string | null
  messages: AIAgentMessage[]
  pendingActions: WsConfirmRequest[]
  sessionRunning: boolean
  streamingDelta: string
  activeToolEvents: Map<string, ToolEventEntry>
  settingsOpen: boolean
  sidebarOpen: boolean
  loading: boolean
  error: string | null
}

const initialState: AgentState = {
  config: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  pendingActions: [],
  sessionRunning: false,
  streamingDelta: '',
  activeToolEvents: new Map(),
  settingsOpen: false,
  sidebarOpen: true,
  loading: false,
  error: null,
}

const useAgentStateStore = create<AgentState>(() => initialState)

function setAgentState(partial: Partial<AgentState>) {
  useAgentStateStore.setState(partial)
}

function getAgentState() {
  return useAgentStateStore.getState()
}

// ──────────────── Computed Helpers ────────────────

export function getActiveSession(s: AgentState): AIAgentSession | undefined {
  return s.sessions.find((ses) => ses.id === s.activeSessionId)
}

function normalizeSessions(
  payload: AIAgentSession[] | { data?: AIAgentSession[] } | null | undefined,
): AIAgentSession[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data
  }

  return []
}

// ──────────────── Async Actions ────────────────

export async function loadConfig() {
  try {
    const config = await api.getConfig()
    setAgentState({ config })
  } catch (err) {
    setAgentState({ error: (err as Error).message })
  }
}

export async function saveConfig(config: Parameters<typeof api.putConfig>[0]) {
  try {
    const result = await api.putConfig(config)
    setAgentState({ config: result })
  } catch (err) {
    setAgentState({ error: (err as Error).message })
    throw err
  }
}

export async function loadSessions() {
  try {
    setAgentState({ loading: true })
    const sessions = normalizeSessions(await api.getSessions())
    setAgentState({ sessions, loading: false })
  } catch (err) {
    setAgentState({
      error: (err as Error).message,
      loading: false,
      sessions: [],
    })
  }
}

export async function createSession(title?: string) {
  try {
    const session = await api.createSession(title)
    const { sessions } = getAgentState()
    setAgentState({
      sessions: [session, ...sessions],
      activeSessionId: session.id,
      messages: [],
      streamingDelta: '',
      pendingActions: [],
      activeToolEvents: new Map(),
    })
  } catch (err) {
    setAgentState({ error: (err as Error).message })
  }
}

export async function switchSession(sessionId: string) {
  setAgentState({
    activeSessionId: sessionId,
    messages: [],
    streamingDelta: '',
    pendingActions: [],
    activeToolEvents: new Map(),
    loading: true,
  })

  try {
    const [sessionDetail, messagesResult] = await Promise.all([
      api.getSession(sessionId),
      api.getMessages(sessionId),
    ])

    const pending: WsConfirmRequest[] = (
      sessionDetail.pending_actions || []
    ).map((a) => ({
      actionId: a.id,
      sessionId: a.session_id,
      toolName: a.tool_name,
      arguments: a.arguments,
      riskLevel: a.risk_level,
      dryRunPreview: a.dry_run_preview,
    }))

    setAgentState({
      messages: messagesResult.data,
      pendingActions: pending,
      loading: false,
    })
  } catch (err) {
    setAgentState({ error: (err as Error).message, loading: false })
  }
}

export async function sendMessage(content: string) {
  const { activeSessionId } = getAgentState()
  if (!activeSessionId) return

  try {
    await api.sendMessage(activeSessionId, content)
  } catch (err) {
    setAgentState({ error: (err as Error).message })
    throw err
  }
}

export async function confirmAction(actionId: string) {
  try {
    await api.confirmAction(actionId)
  } catch (err) {
    setAgentState({ error: (err as Error).message })
    throw err
  }
}

export async function rejectAction(actionId: string) {
  try {
    await api.rejectAction(actionId)
  } catch (err) {
    setAgentState({ error: (err as Error).message })
    throw err
  }
}

// ──────────────── Sync Actions ────────────────

export function setSettingsOpen(open: boolean) {
  setAgentState({ settingsOpen: open })
}

export function setSidebarOpen(open: boolean) {
  setAgentState({ sidebarOpen: open })
}

export function setActiveSessionId(id: string | null) {
  setAgentState({ activeSessionId: id })
}

export function clearError() {
  setAgentState({ error: null })
}

// ──────────────── WS Handlers ────────────────

export function handleSessionState(data: WsSessionState) {
  setAgentState({ sessionRunning: data.state === 'running' })
  if (data.state === 'idle') {
    setAgentState({ streamingDelta: '' })
  }
}

export function handleMessage(data: WsMessagePayload) {
  if ('delta' in data && data.kind === 'assistant_delta') {
    const { streamingDelta } = getAgentState()
    setAgentState({ streamingDelta: streamingDelta + data.delta })
  } else if ('message' in data) {
    const { messages } = getAgentState()
    setAgentState({
      messages: [...messages, data.message],
      streamingDelta: '',
    })
  }
}

export function handleToolEvent(data: WsToolEvent) {
  const { event } = data
  const toolUseId = event.toolUseId || ''
  const { activeToolEvents } = getAgentState()
  const next = new Map(activeToolEvents)

  switch (event.type) {
    case 'tool_execution_start': {
      next.set(toolUseId, {
        toolUseId,
        toolName: event.toolName || 'unknown',
        status: 'running',
        input: event.input,
      })
      break
    }
    case 'tool_execution_update': {
      const existing = next.get(toolUseId)
      if (existing) {
        next.set(toolUseId, { ...existing, output: event.output })
      }
      break
    }
    case 'tool_execution_end': {
      const existing = next.get(toolUseId)
      if (existing) {
        next.set(toolUseId, {
          ...existing,
          status: event.error ? 'error' : 'done',
          output: event.output,
          error: event.error,
        })
      }
      break
    }
  }

  setAgentState({ activeToolEvents: next })
}

export function handleConfirmRequest(data: WsConfirmRequest) {
  const { pendingActions } = getAgentState()
  setAgentState({ pendingActions: [...pendingActions, data] })
}

export function handleConfirmResult(data: WsConfirmResult) {
  const { pendingActions } = getAgentState()
  setAgentState({
    pendingActions: pendingActions.filter((a) => a.actionId !== data.actionId),
  })
}

// ──────────────── Hook ────────────────

export function useAgentStore() {
  const snapshot = useAgentStateStore()

  return {
    ...snapshot,
    setSettingsOpen: useCallback((open: boolean) => setSettingsOpen(open), []),
    setSidebarOpen: useCallback((open: boolean) => setSidebarOpen(open), []),
    newSession: useCallback(() => createSession(), []),
    switchSession: useCallback((id: string) => switchSession(id), []),
    sendMessage: useCallback((content: string) => sendMessage(content), []),
    confirmAction: useCallback((id: string) => confirmAction(id), []),
    rejectAction: useCallback((id: string) => rejectAction(id), []),
    loadConfig: useCallback(() => loadConfig(), []),
    saveConfig: useCallback(
      (config: Parameters<typeof api.putConfig>[0]) => saveConfig(config),
      [],
    ),
    getActiveSession: useCallback(() => getActiveSession(snapshot), [snapshot]),
  }
}
