import type {
  AgentOperation,
  AgentStore,
  AgentToolConfig,
  ToolCallGroupItem,
} from '@haklex/rich-agent-core'
import {
  $captureSelection,
  projectAgentDiffNodesToFactualState,
} from '@haklex/rich-ext-ai-agent'
import { useQuery } from '@tanstack/react-query'
import type { LexicalEditor } from 'lexical'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ProviderModelsResponse } from '~/api/ai'
import { getModels } from '~/api/ai'
import { agentCommitMessage } from '~/features/write/crdt/agent-commit-message'
import type { AgentTurn } from '~/features/write/crdt/crdt-draft-session'
import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'
import { useAgentSessionManager } from '~/hooks/use-agent-session-manager'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { getAdminSocket } from '~/socket/SocketBridge'
import type { AgentLoopHandle, AgentRuntime } from '~/vendor/rich-editor/types'
import {
  buildProposedState,
  buildReviewXml,
  buildSelectionXml,
  createDocumentBashWorkspace,
} from '~/vendor/rich-editor/utils/document-bash'
import { buildDynamicTools } from '~/vendor/rich-editor/utils/dynamic-tools'

import { extractAgentOperationFromToolItem } from './agent-operations'
import { createManagedAgentStore } from './agent-store'
import { createDynamicPublisher } from './publish-dynamic-component'
import type { SelectedAgentModel, UserChatBubble } from './types'
import { createWriteAgentRuntime } from './write-agent-runtime'

export interface WriteAgentController {
  store: AgentStore
  agentRuntime: AgentRuntime | null
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
  documentBashTool: AgentToolConfig
  dynamicTools: AgentToolConfig[]
  publishDynamic: (item: ToolCallGroupItem) => Promise<void>
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

export interface AgentDocument {
  active: boolean
  startAgentTurn: (message: string) => AgentTurn | null
}

export function useWriteAgent(opts: {
  agentVisible: boolean
  document?: AgentDocument
  documentId?: string
  documentKind: 'note' | 'page' | 'post'
  ensureDocument?: () => Promise<boolean>
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

  const documentSessionId = deriveDocumentSessionId(
    opts.documentKind,
    opts.documentId,
  )
  const [generatedProviderSessionId] = useState(() => crypto.randomUUID())
  const providerSessionId = documentSessionId ?? generatedProviderSessionId

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
  const documentRef = useRef(opts.document)
  documentRef.current = opts.document
  const ensureDocumentRef = useRef(opts.ensureDocument)
  ensureDocumentRef.current = opts.ensureDocument
  const turnRef = useRef<AgentTurn | null>(null)
  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const dynamicTools = useMemo(
    () => buildDynamicTools(() => lexicalEditorRef.current),
    [],
  )
  const documentBash = useMemo(
    () =>
      createDocumentBashWorkspace({
        applyDocument: (target, focusBlockId) => {
          if (!turnRef.current) throw new Error('No agent turn is open')
          turnRef.current.apply(target, focusBlockId)
        },
        ownsWrites: () => turnRef.current !== null,
        onSeed: () => turnRef.current?.markView(),
        getBaseState: () => {
          const editor = lexicalEditorRef.current
          if (!editor) return null
          return projectAgentDiffNodesToFactualState(
            editor.getEditorState().toJSON(),
          )
        },
        getEditorState: () => {
          const editor = lexicalEditorRef.current
          if (!editor) return null
          return buildProposedState(
            projectAgentDiffNodesToFactualState(
              editor.getEditorState().toJSON(),
            ),
            store.getState().reviewState,
          )
        },
        getReviewXml: () => buildReviewXml(store.getState().reviewState),
        getSelectionXml: () => {
          const editor = lexicalEditorRef.current
          if (!editor) return ''
          const { liveSelection, pinnedSelection } = store.getState()
          const selection =
            pinnedSelection ??
            liveSelection ??
            editor.getEditorState().read(() => $captureSelection())
          return buildSelectionXml(
            projectAgentDiffNodesToFactualState(
              editor.getEditorState().toJSON(),
            ),
            selection,
          )
        },
      }),
    [store],
  )
  const publishDynamic = useMemo(
    () => createDynamicPublisher(store, () => lexicalEditorRef.current),
    [store],
  )
  const [agentReady, setAgentReady] = useState(false)
  const activeRunRef = useRef<Promise<void> | null>(null)

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
    sessionId: documentSessionId,
    store,
  })
  const ensureConversationRef = useRef(sessionManager.ensureConversation)
  ensureConversationRef.current = sessionManager.ensureConversation

  const agentRuntime = useMemo<AgentRuntime | null>(() => {
    if (!selectedModel) return null
    return createWriteAgentRuntime({
      ensureConversation: () => ensureConversationRef.current(),
      getSocket: getAdminSocket,
      model: selectedModel,
      sessionId: providerSessionId,
      connectionLostMessage: t('write.agent.connectionLost'),
      socketUnavailableMessage: t('write.agent.socketUnavailable'),
      store,
      workspace: documentBash,
    })
  }, [documentBash, providerSessionId, selectedModel, store, t])

  const sendMessage = (message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return
    if (!selectedModel || !agentRuntime) {
      toast.error(t('write.agent.selectModelFirst'))
      return
    }
    const ensureDocument = ensureDocumentRef.current
    if (ensureDocument && !documentRef.current?.active) {
      void ensureDocument().then((ready) => {
        if (ready && documentRef.current?.active) sendMessage(message)
      })
      return
    }
    if (!agentLoopRef.current) {
      toast.error(t('write.agent.notReady'))
      return
    }

    const loop = agentLoopRef.current
    const pinnedSelection = store.getState().pinnedSelection
    const userBubble: UserChatBubble = pinnedSelection
      ? { content: trimmed, selection: pinnedSelection, type: 'user' }
      : { content: trimmed, type: 'user' }
    store.getState().addBubble(userBubble)

    const running = activeRunRef.current
    if (running) {
      void loop.steer(trimmed).then((steered) => {
        if (!steered) void running.then(() => startRun(loop, trimmed))
      })
      return
    }
    startRun(loop, trimmed)
  }

  const startRun = (loop: AgentLoopHandle, message: string) => {
    documentBash.beginRun()
    const shared = documentRef.current
    const turn = shared?.active
      ? shared.startAgentTurn(agentCommitMessage(message))
      : null
    turnRef.current = turn
    const promise = loop.run(message).catch((error: unknown) => {
      if ((error as Error)?.name === 'AbortError') return
      const detail = error instanceof Error ? error.message : String(error)
      store.getState().addBubble({ message: detail, type: 'error' })
      store.getState().setStatus('idle')
    })
    activeRunRef.current = promise
    void promise.then(() => {
      if (activeRunRef.current === promise) activeRunRef.current = null
      if (turn) {
        turn.end()
        if (turnRef.current === turn) turnRef.current = null
      }
    })
  }

  const reapplyBatch = (batchId: string) => {
    const batch = store
      .getState()
      .reviewState?.batches.find((item) => item.id === batchId)
    const editor = lexicalEditorRef.current
    if (!batch || !editor) return

    const run = async () => {
      const { applyAgentReviewBatch } =
        await import('~/vendor/rich-editor/utils/apply-agent-review-batch')
      const summary = applyAgentReviewBatch(editor, batch)

      if (summary.success === 0 && summary.total > 0) {
        toast.error(
          t('write.agent.toast.applyAllFailed', {
            conflict: summary.conflict,
            error: summary.error,
          }),
        )
        return
      }

      if (summary.error || summary.conflict) {
        toast.warning(
          t('write.agent.toast.applyPartial', {
            conflict: summary.conflict,
            error: summary.error,
            success: summary.success,
          }),
        )
        return
      }

      toast.success(t('write.agent.toast.suggestionReapplied'))
    }

    void run().catch((error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('write.agent.toast.applyFailed'),
      )
    })
  }

  // Accept must go through the store only: DiffReviewOverlayPlugin already
  // owns the inline AgentDiff nodes and materializes them on batch
  // resolution. Applying ops to the document here as well double-applies
  // (or conflicts, since pending blocks are replaced by diff decorators).
  const acceptBatch = (batchId: string) => {
    store.getState().acceptReviewBatch(batchId)
    toast.success(t('write.agent.toast.suggestionApplied'))
  }

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
    agentRuntime,
    documentBashTool: documentBash.tool,
    dynamicTools,
    publishDynamic,
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
