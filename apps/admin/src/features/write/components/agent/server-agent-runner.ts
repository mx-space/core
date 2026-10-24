import type {
  AgentOperation,
  AgentStore,
  AgentToolConfig,
  AgentToolResult,
  ChatBubble,
} from '@haklex/rich-agent-core'
import {
  type AgentDonePayload,
  type AgentEventPayload,
  type AgentFileSnapshot,
  type AgentRunPayload,
  type AgentServerEvent,
  type AgentSteerPayload,
  type AgentToolCallPayload,
  type AgentToolResultPayload,
  AgentWsEvents,
} from '@mx-space/ai'
import type { WsAckPayload } from '@mx-space/ws-client'

import {
  addAgentUsage,
  type AgentTurnUsage,
  type ModelCallUsage,
} from './agent-usage'
import type { AssistantChatBubble } from './types'

export interface AgentSocketPort {
  on: (event: string, handler: (payload: any) => void) => () => void
  send: (event: string, payload: unknown) => void
  request: (event: string, payload: unknown) => Promise<WsAckPayload>
}

export type ServerAgentRunInput = Omit<AgentRunPayload, 'runId' | 'tools'>

export interface ServerAgentRunnerConfig {
  socket: AgentSocketPort
  store: AgentStore
  tools: AgentToolConfig[]
  collectFiles?: (toolName: string) => AgentFileSnapshot[]
  onOperationsChanged?: (operations: AgentOperation[]) => void
  connectionLostMessage?: string
}

const CANCEL_GRACE_MS = 5000

export function createServerAgentRunner(config: ServerAgentRunnerConfig) {
  const { socket, store } = config
  const toolMap = new Map(config.tools.map((tool) => [tool.name, tool]))
  let activeRunId: string | null = null

  async function run(
    input: ServerAgentRunInput,
    signal?: AbortSignal,
  ): Promise<AgentDonePayload> {
    const runId = crypto.randomUUID()
    const operations: AgentOperation[] = []
    const view = createBubbleView(store, (name, params) => {
      const tool = toolMap.get(name)
      try {
        return tool?.describeCall?.(params) ?? describe(params)
      } catch {
        return describe(params)
      }
    })
    const disposers: Array<() => void> = []
    let settle!: (done: AgentDonePayload) => void

    const finished = new Promise<AgentDonePayload>((resolve) => {
      settle = (done) => {
        view.finishCall()
        view.attachUsage()
        resolve(done)
      }
      disposers.push(
        socket.on('$state', (state: string) => {
          if (state === 'open') return
          settle({
            error: config.connectionLostMessage ?? 'Connection lost',
            runId,
            status: 'failed',
          })
        }),
        socket.on(AgentWsEvents.event, (payload: AgentEventPayload) => {
          if (payload?.runId === runId) view.apply(payload.event)
        }),
        socket.on(AgentWsEvents.toolCall, (payload: AgentToolCallPayload) => {
          if (payload?.runId === runId) void runClientTool(payload)
        }),
        socket.on(AgentWsEvents.done, (payload: AgentDonePayload) => {
          if (payload?.runId === runId) settle(payload)
        }),
      )
    })

    async function runClientTool(call: AgentToolCallPayload) {
      view.ensureItem(call.toolCallId, call.name, call.arguments)
      const tool = toolMap.get(call.name)
      let result: AgentToolResult
      if (!tool) {
        result = {
          error: {
            error: 'unknown_tool',
            message: `Tool "${call.name}" is not available in this editor`,
          },
          ok: false,
        }
      } else {
        try {
          result = await tool.execute(call.arguments)
        } catch (error) {
          result = {
            error: {
              error: 'tool_failed',
              message: error instanceof Error ? error.message : String(error),
            },
            ok: false,
          }
        }
      }

      if (result.ok && result.operations) {
        if (result.operationsMode === 'replace') {
          operations.splice(0, operations.length, ...result.operations)
        } else {
          operations.push(...result.operations)
        }
        config.onOperationsChanged?.(operations)
      }

      const content = result.ok ? result.content : JSON.stringify(result.error)
      view.settleItem(call.toolCallId, content, !result.ok)
      const files = tool ? config.collectFiles?.(call.name) : undefined
      socket.send(AgentWsEvents.toolResult, {
        content,
        ...(files?.length ? { files } : {}),
        isError: !result.ok,
        runId,
        toolCallId: call.toolCallId,
      } satisfies AgentToolResultPayload)
    }

    let cancelTimer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => {
      socket.send(AgentWsEvents.cancel, { runId })
      cancelTimer = setTimeout(
        () => settle({ runId, status: 'aborted' }),
        CANCEL_GRACE_MS,
      )
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    store.getState().setStatus('running')

    try {
      await socket.request(AgentWsEvents.run, {
        ...input,
        runId,
        tools: config.tools.map(({ description, name, parameters }) => ({
          description,
          name,
          parameters,
        })),
      } satisfies AgentRunPayload)
      activeRunId = runId
      const done = await finished
      store.getState().setStatus('done')
      return done
    } finally {
      if (activeRunId === runId) activeRunId = null
      clearTimeout(cancelTimer)
      signal?.removeEventListener('abort', onAbort)
      for (const dispose of disposers) dispose()
    }
  }

  async function steer(user: string, files: AgentFileSnapshot[]) {
    if (!activeRunId) return false
    try {
      await socket.request(AgentWsEvents.steer, {
        files,
        runId: activeRunId,
        user,
      } satisfies AgentSteerPayload)
      return true
    } catch {
      return false
    }
  }

  return { run, steer }
}

function createBubbleView(
  store: AgentStore,
  describeCall: (
    name: string,
    params: Record<string, unknown>,
  ) => string | undefined,
) {
  let assistant: ChatBubble | null = null
  let lastAssistant: ChatBubble | null = null
  let usage: AgentTurnUsage | undefined
  let text = ''
  let thinkingBubble: ChatBubble | null = null
  let thinking = ''
  let groupId: string | null = null

  const state = () => store.getState()

  const append = (bubble: ChatBubble) => {
    state().addBubble(bubble)
    return state().bubbles.at(-1)!
  }

  const replace = (current: ChatBubble, next: ChatBubble) => {
    const { bubbles } = state()
    const index = bubbles.indexOf(current)
    if (index === -1) return current
    store.setState({ bubbles: bubbles.with(index, next) })
    return next
  }

  const closeAssistant = () => {
    if (!assistant) return
    lastAssistant = replace(assistant, {
      content: text,
      streaming: false,
      type: 'assistant',
    })
    assistant = null
    text = ''
  }

  const closeThinking = () => {
    if (!thinkingBubble || thinkingBubble.type !== 'thinking') return
    replace(thinkingBubble, {
      content: thinking,
      id: thinkingBubble.id,
      isStreaming: false,
      rawText: thinking,
      steps: thinking
        .split(/\n{2,}/)
        .map((step) => step.trim())
        .filter(Boolean),
      type: 'thinking',
    })
    thinkingBubble = null
    thinking = ''
  }

  const ensureGroup = () => {
    closeAssistant()
    if (!groupId) {
      groupId = `tcg-${crypto.randomUUID()}`
      state().addBubble({ id: groupId, items: [], type: 'tool_call_group' })
    }
    state().setStatus('calling_tool')
    return groupId
  }

  const findItem = (id: string) => {
    for (const bubble of state().bubbles) {
      if (bubble.type !== 'tool_call_group') continue
      const item = bubble.items.find((candidate) => candidate.id === id)
      if (item) return { groupId: bubble.id, item }
    }
    return null
  }

  const ensureItem = (
    id: string,
    toolName: string,
    params: Record<string, unknown>,
  ) => {
    if (findItem(id)) return
    state().addToolCallItem(ensureGroup(), {
      description: describeCall(toolName, params),
      id,
      params,
      startedAt: Date.now(),
      status: 'running',
      toolName,
    })
  }

  const settleItem = (id: string, content: string, isError: boolean) => {
    const found = findItem(id)
    if (!found) return
    state().updateToolCallItem(found.groupId, id, {
      error: isError ? content : undefined,
      finishedAt: Date.now(),
      result: isError ? undefined : content,
      resultPreview: isError ? undefined : content.slice(0, 80),
      status: isError ? 'error' : 'completed',
    })
  }

  const finishCall = () => {
    closeThinking()
    closeAssistant()
    groupId = null
  }

  const attachUsage = () => {
    if (!usage || lastAssistant?.type !== 'assistant') return
    const next: AssistantChatBubble = { ...lastAssistant, usage }
    lastAssistant = replace(lastAssistant, next)
  }

  const apply = (event: AgentServerEvent) => {
    switch (event.type) {
      case 'thinking_delta': {
        thinking += event.delta
        const next: ChatBubble = {
          content: thinking,
          id:
            thinkingBubble?.type === 'thinking'
              ? thinkingBubble.id
              : `th-${crypto.randomUUID()}`,
          isStreaming: true,
          rawText: thinking,
          steps: [],
          type: 'thinking',
        }
        if (thinkingBubble) {
          thinkingBubble = replace(thinkingBubble, next)
        } else {
          thinkingBubble = append(next)
          state().setStatus('thinking')
        }
        return
      }
      case 'text_delta': {
        text += event.delta
        const next: ChatBubble = {
          content: text,
          streaming: true,
          type: 'assistant',
        }
        if (assistant) {
          assistant = replace(assistant, next)
        } else {
          assistant = append(next)
          state().setStatus('writing')
        }
        return
      }
      case 'toolcall_end': {
        ensureItem(
          event.toolCall.id,
          event.toolCall.name,
          event.toolCall.arguments,
        )
        return
      }
      case 'tool_result': {
        settleItem(event.toolCallId, event.content, event.isError)
        return
      }
      case 'done': {
        usage = addAgentUsage(
          usage,
          (event.message as { usage?: ModelCallUsage } | undefined)?.usage,
        )
        finishCall()
        return
      }
      default:
    }
  }

  return { apply, attachUsage, ensureItem, finishCall, settleItem }
}

function describe(params: Record<string, unknown>) {
  const first = Object.values(params)[0]
  return first === undefined ? undefined : String(first).slice(0, 40)
}
