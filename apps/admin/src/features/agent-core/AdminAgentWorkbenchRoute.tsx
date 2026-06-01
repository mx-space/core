import { useQuery } from '@tanstack/react-query'
import { Bot, Check, Loader2, Plus, Send, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Streamdown } from 'streamdown'

import { getModels } from '~/api/ai'
import type { AgentConversation } from '~/api/ai-agent'
import {
  createAgentConversation,
  deleteAgentConversation,
  generateAgentConversationTitle,
  getAgentConversation,
  getAgentConversations,
  replaceAgentConversationMessages,
} from '~/api/ai-agent'
import type { SelectedAgentModel } from '~/features/write/components/agent/types'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { adminAgentTransport } from './agent-transport'
import { validateDryRunApproval } from './approval'
import { createGeneralScene } from './contracts'
import { createGeneralAgentTools } from './general-tools'
import type { AgentPersistedMessage } from './message-normalizer'
import { buildTitleProjection } from './message-normalizer'
import type { PersistenceQueue } from './persistence-queue'
import { createPersistenceQueue } from './persistence-queue'
import { buildAgentSystemPrompt } from './system-prompt'
import { runAgentTurn } from './turn-loop'

const GENERAL_SESSION_ID = 'admin-agent:general'
const MODEL_VALUE_SEPARATOR = '::'

function getModelOptionValue(providerId: string, modelId: string) {
  return `${providerId}${MODEL_VALUE_SEPARATOR}${modelId}`
}

function isSelectedAgentModelAvailable(
  model: SelectedAgentModel | null,
  providerGroups: Awaited<ReturnType<typeof getModels>>,
) {
  if (!model) return false
  const provider = providerGroups.find(
    (group) => group.providerId === model.providerId,
  )
  return Boolean(provider?.models.some((item) => item.id === model.modelId))
}

function sessionLabel(conversation: AgentConversation) {
  return (
    conversation.title ??
    deriveTitle(conversation.messages) ??
    conversation.id.slice(0, 8)
  )
}

function deriveTitle(messages: AgentConversation['messages']) {
  const firstUser = messages?.find(
    (message) => message.role === 'user' || message.type === 'user',
  )
  const content =
    typeof firstUser?.content === 'string' ? firstUser.content.trim() : ''
  if (!content) return null
  return content.length > 36 ? `${content.slice(0, 36)}...` : content
}

export function AdminAgentWorkbenchRoute() {
  const { t } = useI18n()
  const [selectedModel, selectModel] =
    useLocalStorageState<SelectedAgentModel | null>(
      'agent-chat:selected-model',
      null,
    )
  const [sessions, setSessions] = useState<AgentConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentPersistedMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const queuesRef = useRef(
    new Map<
      string,
      PersistenceQueue<AgentPersistedMessage[], AgentConversation>
    >(),
  )

  const scene = useMemo(() => createGeneralScene(createGeneralAgentTools()), [])
  const tools = scene.tools
  const systemPrompt = useMemo(() => buildAgentSystemPrompt(scene), [scene])

  const modelsQuery = useQuery({
    queryFn: getModels,
    queryKey: adminQueryKeys.ai.models('admin-agent-workbench'),
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

  const getQueue = useCallback((conversationId: string) => {
    const existing = queuesRef.current.get(conversationId)
    if (existing) return existing
    const queue = createPersistenceQueue<
      AgentPersistedMessage[],
      AgentConversation
    >({
      save: (nextMessages) =>
        replaceAgentConversationMessages(conversationId, nextMessages),
    })
    queuesRef.current.set(conversationId, queue)
    return queue
  }, [])

  const persistMessages = useCallback(
    async (conversationId: string, nextMessages: AgentPersistedMessage[]) => {
      const updated = await getQueue(conversationId).enqueue(nextMessages)
      if (updated) {
        setSessions((current) =>
          current.map((session) =>
            session.id === conversationId ? updated : session,
          ),
        )
      }
      return updated
    },
    [getQueue],
  )

  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const list = await getAgentConversations(GENERAL_SESSION_ID)
      setSessions(list)
      if (!activeId && list[0]) {
        setActiveId(list[0].id)
        const detail = await getAgentConversation(list[0].id)
        setMessages(detail.messages ?? [])
      }
    } finally {
      setIsLoadingSessions(false)
    }
  }, [activeId])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const ensureConversation = useCallback(
    async (initialMessages: AgentPersistedMessage[]) => {
      if (activeId) return activeId
      if (!selectedModel) throw new Error(t('ai.agent.toast.selectModel'))

      const conversation = await createAgentConversation({
        messages: initialMessages,
        model: selectedModel.modelId,
        providerId: selectedModel.providerId,
        sessionId: GENERAL_SESSION_ID,
      })
      setSessions((current) => [conversation, ...current])
      setActiveId(conversation.id)
      return conversation.id
    },
    [activeId, selectedModel, t],
  )

  const runTurn = useCallback(
    async (conversationId: string, baseMessages: AgentPersistedMessage[]) => {
      if (!selectedModel) throw new Error(t('ai.agent.toast.selectModel'))

      const abortController = new AbortController()
      abortRef.current = abortController
      setIsRunning(true)
      try {
        const result = await runAgentTurn({
          messages: baseMessages,
          onMessages: setMessages,
          systemPrompt,
          tools,
          transport: (request) =>
            adminAgentTransport({
              messages: request.messages,
              model: selectedModel.modelId,
              providerId: selectedModel.providerId,
              signal: abortController.signal,
              tools: request.tools,
            }),
        })
        setMessages(result.messages)
        await persistMessages(conversationId, result.messages)
        await generateAgentConversationTitle(conversationId, {
          messages: buildTitleProjection(result.messages),
          model: selectedModel.modelId,
          providerId: selectedModel.providerId,
        }).catch(() => null)
      } finally {
        if (abortRef.current === abortController) abortRef.current = null
        setIsRunning(false)
      }
    },
    [persistMessages, selectedModel, systemPrompt, t, tools],
  )

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || isRunning) return
    if (!selectedModel) {
      toast.error(t('ai.agent.toast.selectModel'))
      return
    }

    const baseMessages = [...messages, { type: 'user', content }]
    setInput('')
    setMessages(baseMessages)

    try {
      const conversationId = await ensureConversation(baseMessages)
      await persistMessages(conversationId, baseMessages)
      await runTurn(conversationId, baseMessages)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('ai.agent.toast.turnFailed'),
      )
    }
  }, [
    ensureConversation,
    input,
    isRunning,
    messages,
    persistMessages,
    runTurn,
    selectedModel,
  ])

  const switchSession = useCallback(async (conversationId: string) => {
    abortRef.current?.abort()
    setActiveId(conversationId)
    const detail = await getAgentConversation(conversationId)
    setMessages(detail.messages ?? [])
  }, [])

  const createSession = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    setInput('')
  }, [])

  const removeSession = useCallback(async () => {
    if (!activeId) return
    abortRef.current?.abort()
    await deleteAgentConversation(activeId)
    queuesRef.current.delete(activeId)
    setSessions((current) =>
      current.filter((session) => session.id !== activeId),
    )
    setActiveId(null)
    setMessages([])
  }, [activeId])

  const approveDryRun = useCallback(
    async (message: AgentPersistedMessage) => {
      if (!activeId || !selectedModel || isRunning) return
      const toolName =
        typeof message.toolName === 'string' ? message.toolName : ''
      const tool = tools.find((item) => item.manifest.name === toolName)
      if (!tool?.execute) {
        toast.error(t('ai.agent.toast.noExecuteHandler'))
        return
      }

      setIsRunning(true)
      try {
        const validation = await validateDryRunApproval(message, tool)
        if (!validation.ok) {
          toast.error(validation.reason)
          return
        }
        const args = validation.args
        const result = await tool.execute(args, {
          arguments: args,
          id: String(message.toolCallId ?? ''),
          name: toolName,
        })
        const nextMessages = [
          ...messages,
          {
            decision: 'approved',
            dryRunHash: message.dryRunHash,
            type: 'approval',
          },
          {
            content: result.content,
            isError: Boolean(result.isError),
            toolCallId: message.toolCallId,
            toolName,
            type: 'execute-result',
          },
        ]
        setMessages(nextMessages)
        await persistMessages(activeId, nextMessages)
        await runTurn(activeId, nextMessages)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('ai.agent.toast.executeFailed'),
        )
      } finally {
        setIsRunning(false)
      }
    },
    [
      activeId,
      isRunning,
      messages,
      persistMessages,
      runTurn,
      selectedModel,
      tools,
    ],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <AppPage>
      <PageHeader
        actions={[
          {
            kind: 'custom',
            node: (
              <WorkbenchModelSelect
                isLoading={modelsQuery.isLoading}
                onSelect={selectModel}
                providerGroups={providerGroups}
                selectedModel={selectedModel}
              />
            ),
          },
          {
            kind: 'button',
            icon: Plus,
            label: t('ai.agent.action.new'),
            onClick: createSession,
          },
          {
            kind: 'button',
            disabled: !activeId,
            icon: Trash2,
            iconOnly: true,
            label: t('ai.agent.action.delete'),
            onClick: () => void removeSession(),
          },
        ]}
        description={t('routes.aiAgent.description')}
        icon={<Bot aria-hidden="true" className="size-3.5" />}
        title={t('routes.aiAgent.title')}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
        <aside className="min-h-0 border-r border-border bg-surface-page">
          <Scroll className="h-full">
            <div className="p-2">
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-6 text-fg-muted">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-fg-muted">
                  {t('ai.agent.session.empty')}
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    className={cn(
                      'mb-1 block w-full truncate rounded-sm px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-inset hover:text-fg',
                      activeId === session.id && 'bg-surface-inset text-fg',
                    )}
                    key={session.id}
                    onClick={() => void switchSession(session.id)}
                    type="button"
                  >
                    {sessionLabel(session)}
                  </button>
                ))
              )}
            </div>
          </Scroll>
        </aside>

        <main className="flex min-h-0 flex-col">
          <Scroll className="flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
              {messages.length === 0 ? (
                <div className="py-20 text-center text-sm text-fg-muted">
                  {t('ai.agent.empty')}
                </div>
              ) : (
                messages.map((message, index) => (
                  <MessageItem
                    isRunning={isRunning}
                    key={index}
                    message={message}
                    onApprove={approveDryRun}
                  />
                ))
              )}
            </div>
          </Scroll>

          <div className="border-t border-border bg-surface-page p-3">
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <textarea
                className="min-h-11 flex-1 resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-fg outline-hidden focus:border-accent"
                disabled={isRunning}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder={t('ai.agent.composer.placeholder')}
                rows={2}
                value={input}
              />
              {isRunning ? (
                <Button
                  iconOnly
                  onClick={abort}
                  title={t('ai.agent.action.abort')}
                  variant="secondary"
                >
                  <Square aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <Button
                  iconOnly
                  onClick={() => void sendMessage()}
                  title={t('ai.agent.action.send')}
                >
                  <Send aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppPage>
  )
}

function WorkbenchModelSelect(props: {
  isLoading: boolean
  onSelect: (model: SelectedAgentModel | null) => void
  providerGroups: Awaited<ReturnType<typeof getModels>>
  selectedModel: SelectedAgentModel | null
}) {
  const { t } = useI18n()
  const options = useMemo(
    () =>
      props.providerGroups.flatMap((provider) =>
        provider.models.map((model) => ({
          label: `${provider.providerName} / ${model.name}`,
          model: {
            modelId: model.id,
            providerId: provider.providerId,
            providerType: provider.providerType,
          },
          value: getModelOptionValue(provider.providerId, model.id),
        })),
      ),
    [props.providerGroups],
  )
  const value = props.selectedModel
    ? getModelOptionValue(
        props.selectedModel.providerId,
        props.selectedModel.modelId,
      )
    : ''

  return (
    <select
      aria-label={t('ai.agent.model.label')}
      className="h-9 max-w-72 rounded-sm border border-border bg-surface-card px-2 text-sm text-fg outline-hidden transition-colors hover:bg-surface-inset focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
      disabled={props.isLoading || options.length === 0}
      onChange={(event) => {
        const option = options.find((item) => item.value === event.target.value)
        props.onSelect(option?.model ?? null)
      }}
      value={value}
    >
      {props.isLoading ? (
        <option value="">{t('ai.agent.model.loading')}</option>
      ) : options.length === 0 ? (
        <option value="">{t('ai.agent.model.empty')}</option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function MessageItem(props: {
  isRunning: boolean
  message: AgentPersistedMessage
  onApprove: (message: AgentPersistedMessage) => void
}) {
  const { t } = useI18n()
  const { message } = props
  const role = message.role ?? message.type
  if (role === 'system' || role === 'core-system' || role === 'scene-system') {
    return null
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-sm bg-accent px-3 py-2 text-sm text-white">
          {String(message.content ?? '')}
        </div>
      </div>
    )
  }

  if (role === 'dry-run-result') {
    return (
      <div className="max-w-[78%] rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="font-medium">{t('ai.agent.dryRun.title')}</div>
        <pre className="mt-2 whitespace-pre-wrap text-xs leading-5">
          {String(message.summary ?? '')}
        </pre>
        <Button
          className="mt-3"
          disabled={props.isRunning}
          onClick={() => props.onApprove(message)}
          variant="secondary"
        >
          <Check aria-hidden="true" className="size-4" />
          {t('ai.agent.action.approve')}
        </Button>
      </div>
    )
  }

  if (role === 'tool_result' || role === 'execute-result') {
    return (
      <div className="max-w-[78%] rounded-sm border border-border bg-surface-inset px-3 py-2 text-xs text-fg-muted">
        {String(message.content ?? message.summary ?? '')}
      </div>
    )
  }

  if (role === 'thinking') {
    return (
      <div className="max-w-[78%] rounded-sm border border-border bg-surface-inset px-3 py-2 text-xs text-fg-muted">
        <div className="font-medium text-fg-subtle">
          {t('ai.agent.thinking')}
        </div>
        <div className="mt-1 whitespace-pre-wrap">
          {String(message.content ?? '')}
        </div>
      </div>
    )
  }

  if (role === 'tool_call') {
    return (
      <div className="text-xs text-fg-subtle">
        {t('ai.agent.toolCall.streaming', {
          toolName: String(message.toolName ?? message.content ?? ''),
        })}
      </div>
    )
  }

  if (role === 'assistant_tool_call') {
    return (
      <div className="text-xs text-fg-subtle">
        {t('ai.agent.toolCall.requested', {
          payload: JSON.stringify(message.toolCalls ?? []),
        })}
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-w-[78%] text-sm text-fg dark:prose-invert">
      <Streamdown
        animated={{
          animation: 'fadeIn',
          duration: 180,
          easing: 'ease-out',
          sep: 'char',
        }}
        isAnimating={Boolean(message.streaming)}
      >
        {String(message.content ?? '')}
      </Streamdown>
    </div>
  )
}
