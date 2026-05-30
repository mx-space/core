import type {
  AgentOperation,
  AgentStore,
  LLMProvider,
  ToolCallGroupItem,
  TransportAdapter,
} from '@haklex/rich-agent-core'
import { createProvider } from '@haklex/rich-agent-core'
import { useQuery } from '@tanstack/react-query'
import type { LexicalEditor } from 'lexical'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ProviderModelsResponse } from '~/api/ai'
import { getModels } from '~/api/ai'
import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'
import { useAgentSessionManager } from '~/hooks/use-agent-session-manager'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import type { AgentLoopHandle } from '~/vendor/rich-editor/types'

import { extractAgentOperationFromToolItem } from './agent-operations'
import { createManagedAgentStore } from './agent-store'
import { mapAgentProviderType } from './agent-transport'
import type { SelectedAgentModel } from './types'

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
  reapplyToolGroup: (items: ToolCallGroupItem[]) => void
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

// 18a wires the admin to the new session-keyed backend and SSE event types.
// The streaming pipeline that consumes those events through Lexical and the
// haklex agent loop is replaced wholesale in 18b, so the transport handed to
// `createProvider` here is intentionally inert: it satisfies the haklex
// signature and lets `useWriteAgent` keep its public shape during the
// transition.
function createPlaceholderTransport(): TransportAdapter {
  return async () =>
    new Response(new ReadableStream(), {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200,
    })
}

function deriveDocumentSessionId(
  documentKind: 'note' | 'page' | 'post',
  documentId: string | undefined,
): string | undefined {
  if (!documentId) return undefined
  return `${documentKind}:${documentId}`
}

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

  const provider = useMemo<LLMProvider | null>(() => {
    if (!selectedModel) return null
    return createProvider({
      model: selectedModel.modelId,
      providerType: mapAgentProviderType(selectedModel.providerType),
      transport: createPlaceholderTransport(),
    })
  }, [selectedModel])

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

  const agentLoopRef = useRef<AgentLoopHandle | null>(null)
  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const [agentReady, setAgentReady] = useState(false)

  const onAgentLoopReady = (loop: AgentLoopHandle | null) => {
    agentLoopRef.current = loop
    setAgentReady(Boolean(loop))
  }

  const onEditorReady = (editor: LexicalEditor | null) => {
    lexicalEditorRef.current = editor
  }

  useEffect(
    () => () => {
      agentLoopRef.current = null
      lexicalEditorRef.current = null
      setAgentReady(false)
    },
    [],
  )

  const abort = () => {
    agentLoopRef.current?.abort()
    store.getState().setStatus('idle')
  }

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

  const sendMessage = (message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return
    if (!selectedModel || !provider) {
      toast.error(t('write.agent.selectModelFirst'))
      return
    }
    if (!agentLoopRef.current) {
      toast.error(t('write.agent.notReady'))
      return
    }

    store.getState().addBubble({ content: trimmed, type: 'user' })
    agentLoopRef.current.run(trimmed).catch((error: unknown) => {
      if ((error as Error)?.name === 'AbortError') return
      const detail = error instanceof Error ? error.message : String(error)
      store.getState().addBubble({ message: detail, type: 'error' })
      store.getState().setStatus('idle')
    })
  }

  const reapplyToolGroup = (items: ToolCallGroupItem[]) => {
    const editor = lexicalEditorRef.current
    if (!editor) {
      toast.error(t('write.agent.editorNotReady'))
      return
    }

    const operations = items
      .map(extractAgentOperationFromToolItem)
      .filter((op): op is AgentOperation => Boolean(op))
    if (operations.length === 0) {
      toast.error(t('write.agent.toolResults.empty'))
      return
    }

    const run = async () => {
      const { applyAgentOperation } =
        await import('~/vendor/rich-editor/utils/apply-agent-review-batch')
      const summary = { conflict: 0, error: 0, success: 0 }

      for (const operation of operations) {
        const result = applyAgentOperation(editor, operation)
        summary[result.status] += 1
      }

      if (summary.error || summary.conflict) {
        toast.warning(
          t('write.agent.toast.reapplyPartial', {
            conflict: summary.conflict,
            error: summary.error,
            success: summary.success,
          }),
        )
        return
      }

      toast.success(
        t('write.agent.toast.reapplySuccess', { count: summary.success }),
      )
    }

    void run().catch((error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('write.agent.toast.reapplyFailed'),
      )
    })
  }

  return {
    abort,
    activeSessionId: sessionManager.activeSessionId,
    agentReady,
    createSession: sessionManager.createSession,
    deleteSession: sessionManager.deleteSession,
    isHydrating: sessionManager.isHydrating,
    isLoadingModels: modelsQuery.isLoading,
    isLoadingSessions: sessionManager.isLoading,
    loadSessionsError: sessionManager.loadError,
    onAgentLoopReady,
    onEditorReady,
    provider,
    providerGroups,
    reapplyToolGroup,
    renameSession: sessionManager.renameSession,
    retryLoadSessions: sessionManager.loadSessions,
    selectModel,
    selectedModel,
    sendMessage,
    sessions: sessionManager.sessions,
    store,
    switchSession: sessionManager.switchSession,
  }
}
