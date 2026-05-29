import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  AgentOperation,
  AgentStore,
  LLMProvider,
  ToolCallGroupItem,
} from '@haklex/rich-agent-core'
import type { ProviderModelsResponse } from '~/api/ai'
import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'
import type { AgentLoopHandle } from '~/vendor/rich-editor/types'
import type { LexicalEditor } from 'lexical'
import type { SelectedAgentModel } from './types'

import { createProvider } from '@haklex/rich-agent-core'

import { getModels } from '~/api/ai'
import { useAgentSessionManager } from '~/hooks/use-agent-session-manager'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { extractAgentOperationFromToolItem } from './agent-operations'
import { createManagedAgentStore } from './agent-store'
import {
  createAdminAgentTransport,
  mapAgentProviderType,
} from './agent-transport'

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
  acceptBatch: (batchId: string) => void
  rejectBatch: (batchId: string) => void
  reapplyBatch: (batchId: string) => void
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

export function useWriteAgent(opts: {
  agentVisible: boolean
  kind: 'note' | 'page' | 'post'
  refId?: string
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
      transport: createAdminAgentTransport(selectedModel.providerId),
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

  const sessionManager = useAgentSessionManager({
    abort,
    getModel: () => selectedModel?.modelId ?? '',
    getProviderId: () => selectedModel?.providerId ?? '',
    refId: opts.refId,
    refType: opts.kind,
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

  const applyBatch = (batchId: string, mode: 'accept' | 'reapply') => {
    const batch = store
      .getState()
      .reviewState?.batches.find((item) => item.id === batchId)
    const editor = lexicalEditorRef.current
    if (!batch || !editor) return

    const run = async () => {
      const { applyAgentReviewBatch } =
        await import('~/vendor/rich-editor/utils/apply-agent-review-batch')
      applyAgentReviewBatch(editor, batch)
      if (mode === 'accept') store.getState().acceptReviewBatch(batchId)
      toast.success(
        mode === 'accept'
          ? t('write.agent.toast.suggestionApplied')
          : t('write.agent.toast.suggestionReapplied'),
      )
    }

    void run().catch((error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('write.agent.toast.applyFailed'),
      )
    })
  }

  const acceptBatch = (batchId: string) => applyBatch(batchId, 'accept')
  const reapplyBatch = (batchId: string) => applyBatch(batchId, 'reapply')

  const rejectBatch = (batchId: string) => {
    store.getState().rejectReviewBatch(batchId)
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
    acceptBatch,
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
    reapplyBatch,
    reapplyToolGroup,
    rejectBatch,
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
