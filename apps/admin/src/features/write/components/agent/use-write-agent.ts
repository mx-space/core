import type { AgentStore, LLMProvider } from '@haklex/rich-agent-core'
import { useQuery } from '@tanstack/react-query'
import type { LexicalEditor } from 'lexical'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ProviderModelsResponse } from '~/api/ai'
import { getModels } from '~/api/ai'
import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'
import { useAgentSessionManager } from '~/hooks/use-agent-session-manager'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import type { AgentLoopHandle } from '~/vendor/rich-editor/types'

import { createManagedAgentStore } from './agent-store'
import { createAdminAgentTransport } from './agent-transport'
import type {
  AgentStreamStatus,
  AgentToolCallFinal,
  AssistantBlock,
  ChatMessageEntry,
  SelectedAgentModel,
} from './types'

export interface WriteAgentController {
  store: AgentStore
  provider: LLMProvider | null
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  onEditorReady: (editor: LexicalEditor | null) => void
  agentReady: boolean
  providerGroups: ProviderModelsResponse[]
  isLoadingModels: boolean
  selectedModel: SelectedAgentModel | null
  selectModel: (model: SelectedAgentModel | null) => void
  sessions: AgentSessionMeta[]
  activeSessionId: string | null
  isLoadingSessions: boolean
  isHydrating: boolean
  loadSessionsError: boolean
  createSession: () => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  switchSession: (id: string) => void
  retryLoadSessions: () => void
  sendMessage: (message: string) => void
  abort: () => void
  messages: ChatMessageEntry[]
  streamStatus: AgentStreamStatus
  handleToolCallEnd: (toolCall: AgentToolCallFinal) => void
}

function isSelectedAgentModelAvailable(
  model: SelectedAgentModel | null,
  providerGroups: ProviderModelsResponse[],
) {
  if (!model) return false
  const provider = providerGroups.find(
    (group) => group.providerId === model.providerId,
  )

  return Boolean(provider?.models.some((item) => item.id === model.modelId))
}

function deriveDocumentSessionId(
  documentKind: 'note' | 'page' | 'post',
  documentId: string | undefined,
): string | undefined {
  if (!documentId) return undefined
  return `${documentKind}:${documentId}`
}

function generateMessageId() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface MessageDispatcher {
  appendUser: (text: string) => string
  startAssistant: () => string
  applyBlockUpdate: (
    assistantId: string,
    contentIndex: number,
    updater: (prev: AssistantBlock | undefined) => AssistantBlock,
  ) => void
  finalizeStreaming: (assistantId: string) => void
  appendError: (message: string) => void
  reset: () => void
}

function useMessageState(): {
  messages: ChatMessageEntry[]
  dispatcher: MessageDispatcher
} {
  const [messages, setMessages] = useState<ChatMessageEntry[]>([])

  const dispatcher = useMemo<MessageDispatcher>(() => {
    return {
      appendUser(text) {
        const id = generateMessageId()
        setMessages((prev) => [...prev, { id, role: 'user', text }])
        return id
      },
      startAssistant() {
        const id = generateMessageId()
        setMessages((prev) => [...prev, { id, role: 'assistant', blocks: [] }])
        return id
      },
      applyBlockUpdate(assistantId, contentIndex, updater) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantId || msg.role !== 'assistant') return msg
            const idx = msg.blocks.findIndex(
              (b) => b.contentIndex === contentIndex,
            )
            const current = idx >= 0 ? msg.blocks[idx] : undefined
            const next = updater(current)
            const blocks =
              idx >= 0
                ? msg.blocks.map((b, i) => (i === idx ? next : b))
                : [...msg.blocks, next]
            return { ...msg, blocks }
          }),
        )
      },
      finalizeStreaming(assistantId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantId || msg.role !== 'assistant') return msg
            return {
              ...msg,
              blocks: msg.blocks.map((b) =>
                b.status === 'streaming' ? { ...b, status: 'done' } : b,
              ),
            }
          }),
        )
      },
      appendError(message) {
        setMessages((prev) => [
          ...prev,
          { id: generateMessageId(), role: 'error', message },
        ])
      },
      reset() {
        setMessages([])
      },
    }
  }, [])

  return { messages, dispatcher }
}

const NODE_EDIT_TOOLS = new Set(['insert_node', 'replace_node', 'delete_node'])

export function useWriteAgent(opts: {
  agentVisible: boolean
  documentId?: string
  documentKind: 'note' | 'page' | 'post'
}): WriteAgentController {
  const { t } = useI18n()

  const storeRef = useRef<AgentStore | null>(null)
  if (!storeRef.current) storeRef.current = createManagedAgentStore()
  const store = storeRef.current

  const [selectedModel, selectModel] =
    useLocalStorageState<SelectedAgentModel | null>(
      'agent-chat:selected-model',
      null,
    )

  const modelsQuery = useQuery({
    enabled: opts.agentVisible,
    queryFn: getModels,
    queryKey: adminQueryKeys.ai.models('write-agent'),
  })
  const providerGroups = modelsQuery.data ?? []

  useEffect(() => {
    if (!providerGroups.length) return
    if (isSelectedAgentModelAvailable(selectedModel, providerGroups)) return

    const firstProvider = providerGroups.find(
      (group) => group.models.length > 0,
    )
    const firstModel = firstProvider?.models[0]
    if (!firstProvider || !firstModel) {
      selectModel(null)
      return
    }

    selectModel({
      modelId: firstModel.id,
      providerId: firstProvider.providerId,
      providerType: firstProvider.providerType,
    })
  }, [providerGroups, selectedModel, selectModel])

  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const onAgentLoopReady = (_loop: AgentLoopHandle | null) => {
    // 18b drives streaming directly through the admin SSE transport; the
    // haklex AgentLoop handle is intentionally ignored here, but the callback
    // remains so the RichEditorWithAgent contract is unchanged.
  }

  const onEditorReady = (editor: LexicalEditor | null) => {
    lexicalEditorRef.current = editor
  }

  useEffect(
    () => () => {
      lexicalEditorRef.current = null
    },
    [],
  )

  const { messages, dispatcher } = useMessageState()
  const [streamStatus, setStreamStatus] = useState<AgentStreamStatus>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const dispatchedToolsRef = useRef<Set<string>>(new Set())

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreamStatus('idle')
  }, [])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      abortRef.current = null
    },
    [],
  )

  const handleToolCallEnd = useCallback(
    (toolCall: AgentToolCallFinal) => {
      if (!NODE_EDIT_TOOLS.has(toolCall.name)) return
      if (dispatchedToolsRef.current.has(toolCall.id)) return
      dispatchedToolsRef.current.add(toolCall.id)

      const editor = lexicalEditorRef.current
      if (!editor) return

      void (async () => {
        try {
          const { applyAgentOperation } =
            await import('~/vendor/rich-editor/utils/apply-agent-review-batch')
          const opMap: Record<string, 'insert' | 'replace' | 'delete'> = {
            insert_node: 'insert',
            replace_node: 'replace',
            delete_node: 'delete',
          }
          const operation = {
            op: opMap[toolCall.name],
            ...toolCall.arguments,
          } as Parameters<typeof applyAgentOperation>[1]
          const result = applyAgentOperation(editor, operation)
          if (result.status === 'error' || result.status === 'conflict') {
            toast.warning(result.message ?? t('write.agent.toast.applyFailed'))
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('write.agent.toast.applyFailed'),
          )
        }
      })()
    },
    [t],
  )

  const documentSessionId = deriveDocumentSessionId(
    opts.documentKind,
    opts.documentId,
  )

  const sessionManager = useAgentSessionManager({
    abort,
    getModel: () => selectedModel?.modelId ?? '',
    getProviderId: () => selectedModel?.providerId ?? '',
    sessionId: documentSessionId,
    store,
  })

  useEffect(() => {
    if (!sessionManager.activeSessionId) return
    dispatcher.reset()
    dispatchedToolsRef.current.clear()
  }, [dispatcher, sessionManager.activeSessionId])

  const sendMessage = useCallback(
    (message: string) => {
      const trimmed = message.trim()
      if (!trimmed) return
      if (!selectedModel) {
        toast.error(t('write.agent.selectModelFirst'))
        return
      }

      dispatcher.appendUser(trimmed)
      const assistantId = dispatcher.startAssistant()
      setStreamStatus('connecting')

      const controller = new AbortController()
      abortRef.current = controller

      const transport = createAdminAgentTransport(selectedModel.providerId)
      const stream = transport({
        messages: [{ role: 'user', content: trimmed }],
        model: selectedModel.modelId,
        signal: controller.signal,
      })

      void (async () => {
        let openedAny = false
        try {
          for await (const event of stream) {
            if (!openedAny) {
              openedAny = true
              setStreamStatus('streaming')
            }

            switch (event.type) {
              case 'text_start': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) =>
                    prev && prev.kind === 'text'
                      ? prev
                      : {
                          kind: 'text',
                          contentIndex: event.contentIndex,
                          text: '',
                          status: 'streaming',
                        },
                )
                break
              }
              case 'text_delta': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    const base =
                      prev && prev.kind === 'text'
                        ? prev
                        : {
                            kind: 'text' as const,
                            contentIndex: event.contentIndex,
                            text: '',
                            status: 'streaming' as const,
                          }
                    return { ...base, text: base.text + event.delta }
                  },
                )
                break
              }
              case 'text_end': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    if (!prev || prev.kind !== 'text') {
                      return {
                        kind: 'text',
                        contentIndex: event.contentIndex,
                        text: '',
                        status: 'done',
                      }
                    }
                    return { ...prev, status: 'done' }
                  },
                )
                break
              }
              case 'thinking_start': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) =>
                    prev && prev.kind === 'thinking'
                      ? prev
                      : {
                          kind: 'thinking',
                          contentIndex: event.contentIndex,
                          text: '',
                          status: 'streaming',
                          startedAt: Date.now(),
                        },
                )
                break
              }
              case 'thinking_delta': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    const base =
                      prev && prev.kind === 'thinking'
                        ? prev
                        : {
                            kind: 'thinking' as const,
                            contentIndex: event.contentIndex,
                            text: '',
                            status: 'streaming' as const,
                            startedAt: Date.now(),
                          }
                    return { ...base, text: base.text + event.delta }
                  },
                )
                break
              }
              case 'thinking_end': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    if (!prev || prev.kind !== 'thinking') {
                      return {
                        kind: 'thinking',
                        contentIndex: event.contentIndex,
                        text: '',
                        status: 'done',
                        startedAt: Date.now(),
                        endedAt: Date.now(),
                      }
                    }
                    return { ...prev, status: 'done', endedAt: Date.now() }
                  },
                )
                break
              }
              case 'toolcall_start': {
                const name = event.name ?? ''
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) =>
                    prev && prev.kind === 'toolcall'
                      ? prev
                      : {
                          kind: 'toolcall',
                          contentIndex: event.contentIndex,
                          toolName: name,
                          partialArgs: {},
                          status: 'streaming',
                        },
                )
                break
              }
              case 'toolcall_delta': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    const base =
                      prev && prev.kind === 'toolcall'
                        ? prev
                        : {
                            kind: 'toolcall' as const,
                            contentIndex: event.contentIndex,
                            toolName: '',
                            partialArgs: {},
                            status: 'streaming' as const,
                          }
                    return {
                      ...base,
                      partialArgs: {
                        ...base.partialArgs,
                        ...event.partialArgs,
                      },
                    }
                  },
                )
                break
              }
              case 'toolcall_end': {
                dispatcher.applyBlockUpdate(
                  assistantId,
                  event.contentIndex,
                  (prev) => {
                    const base =
                      prev && prev.kind === 'toolcall'
                        ? prev
                        : {
                            kind: 'toolcall' as const,
                            contentIndex: event.contentIndex,
                            toolName: event.toolCall.name,
                            partialArgs: {},
                            status: 'streaming' as const,
                          }
                    return {
                      ...base,
                      toolName: event.toolCall.name,
                      toolCallId: event.toolCall.id,
                      finalArgs: event.toolCall.arguments,
                      status: 'done',
                    }
                  },
                )
                handleToolCallEnd({
                  id: event.toolCall.id,
                  name: event.toolCall.name,
                  arguments: event.toolCall.arguments,
                })
                break
              }
              case 'done': {
                dispatcher.finalizeStreaming(assistantId)
                setStreamStatus('idle')
                break
              }
              case 'error': {
                dispatcher.appendError(event.message || 'Agent error')
                setStreamStatus('error')
                break
              }
            }
          }

          if (streamStatusFromController(controller) !== 'aborted') {
            dispatcher.finalizeStreaming(assistantId)
            if (abortRef.current === controller) {
              setStreamStatus('idle')
            }
          }
        } catch (error) {
          if ((error as Error)?.name === 'AbortError') {
            dispatcher.finalizeStreaming(assistantId)
            setStreamStatus('idle')
            return
          }
          dispatcher.finalizeStreaming(assistantId)
          if (controller.signal.aborted) {
            setStreamStatus('idle')
            return
          }
          dispatcher.appendError(
            error instanceof Error ? error.message : String(error),
          )
          setStreamStatus('connection_lost')
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      })()
    },
    [dispatcher, handleToolCallEnd, selectedModel, t],
  )

  return {
    abort,
    activeSessionId: sessionManager.activeSessionId,
    agentReady: true,
    createSession: sessionManager.createSession,
    deleteSession: sessionManager.deleteSession,
    handleToolCallEnd,
    isHydrating: sessionManager.isHydrating,
    isLoadingModels: modelsQuery.isLoading,
    isLoadingSessions: sessionManager.isLoading,
    loadSessionsError: sessionManager.loadError,
    messages,
    onAgentLoopReady,
    onEditorReady,
    provider: null,
    providerGroups,
    renameSession: sessionManager.renameSession,
    retryLoadSessions: sessionManager.loadSessions,
    selectModel,
    selectedModel,
    sendMessage,
    sessions: sessionManager.sessions,
    store,
    streamStatus,
    switchSession: sessionManager.switchSession,
  }
}

function streamStatusFromController(controller: AbortController) {
  return controller.signal.aborted ? 'aborted' : 'live'
}
