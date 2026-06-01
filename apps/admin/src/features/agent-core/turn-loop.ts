import type { AiAgentSseEvent } from '@mx-space/ai'

import type {
  AgentPersistedMessage,
  AgentWireMessage,
} from './message-normalizer'
import { compileAgentMessages } from './message-normalizer'

export type AgentToolKind =
  | 'draftPatch'
  | 'executePatch'
  | 'executeReply'
  | 'read'
  | 'replyDraft'

export interface AgentToolManifest {
  description: string
  name: string
  parameters: Record<string, unknown>
}

export interface AgentToolHandlerResult {
  content: string
  isError?: boolean
}

export interface AgentDryRunResult {
  blockingReasons?: string[]
  dryRunHash: string
  summary: string
}

export interface AgentToolDefinition {
  dryRun?: (
    args: Record<string, unknown>,
    toolCall: AgentToolCall,
  ) => Promise<AgentDryRunResult>
  execute?: (
    args: Record<string, unknown>,
    toolCall: AgentToolCall,
  ) => Promise<AgentToolHandlerResult>
  kind: AgentToolKind
  manifest: AgentToolManifest
  read?: (
    args: Record<string, unknown>,
    toolCall: AgentToolCall,
  ) => Promise<AgentToolHandlerResult>
}

export interface AgentToolCall {
  arguments: Record<string, unknown>
  id: string
  name: string
}

export type AgentTurnStatus =
  | 'completed'
  | 'iteration_limit'
  | 'paused_for_approval'

export interface AgentTurnResult {
  messages: AgentPersistedMessage[]
  status: AgentTurnStatus
}

export interface RunAgentTurnOptions {
  maxToolIterations?: number
  messages: AgentPersistedMessage[]
  onMessages?: (messages: AgentPersistedMessage[]) => void
  systemPrompt?: string
  tools: AgentToolDefinition[]
  transport: (request: {
    messages: AgentWireMessage[]
    tools: AgentToolManifest[]
  }) => AsyncIterable<AiAgentSseEvent>
}

const DEFAULT_MAX_TOOL_ITERATIONS = 5

export async function runAgentTurn({
  maxToolIterations = DEFAULT_MAX_TOOL_ITERATIONS,
  messages,
  onMessages,
  systemPrompt,
  tools,
  transport,
}: RunAgentTurnOptions): Promise<AgentTurnResult> {
  let nextMessages = [...messages]
  const toolsByName = new Map(tools.map((tool) => [tool.manifest.name, tool]))

  for (let iteration = 0; iteration <= maxToolIterations; iteration++) {
    if (iteration === maxToolIterations) {
      return {
        messages: [
          ...nextMessages,
          {
            content: `Tool iteration limit reached after ${maxToolIterations} iterations.`,
            type: 'execute-result',
          },
        ],
        status: 'iteration_limit',
      }
    }

    const assistant = await collectAssistantTurn(
      transport({
        messages: compileTurnMessages(nextMessages, systemPrompt),
        tools: tools.map((tool) => tool.manifest),
      }),
      {
        baseMessages: nextMessages,
        onMessages,
      },
    )

    if (assistant.text.length > 0) {
      nextMessages = [
        ...nextMessages,
        { content: assistant.text, type: 'assistant' },
      ]
    }

    if (assistant.toolCalls.length === 0) {
      return { messages: nextMessages, status: 'completed' }
    }

    nextMessages = [
      ...nextMessages,
      {
        content: assistant.text,
        role: 'assistant_tool_call',
        toolCalls: assistant.toolCalls,
      },
    ]

    let shouldContinue = false

    for (const toolCall of assistant.toolCalls) {
      if (hasToolResult(nextMessages, toolCall.id)) continue

      const tool = toolsByName.get(toolCall.name)
      if (!tool) {
        nextMessages = appendToolResult(nextMessages, toolCall, {
          content: `Tool "${toolCall.name}" is not available in this scene.`,
          isError: true,
        })
        shouldContinue = true
        onMessages?.(nextMessages)
        continue
      }

      if (tool.kind === 'read') {
        if (!tool.read) {
          nextMessages = appendToolResult(nextMessages, toolCall, {
            content: `Tool "${toolCall.name}" has no read handler.`,
            isError: true,
          })
        } else {
          nextMessages = appendToolResult(
            nextMessages,
            toolCall,
            await tool.read(toolCall.arguments, toolCall),
          )
        }
        shouldContinue = true
        onMessages?.(nextMessages)
        continue
      }

      const dryRun = tool.dryRun
        ? await tool.dryRun(toolCall.arguments, toolCall)
        : {
            dryRunHash: toolCall.id,
            summary: `Tool "${toolCall.name}" requires approval before execution.`,
          }
      nextMessages = [
        ...nextMessages,
        {
          arguments: toolCall.arguments,
          blockingReasons: dryRun.blockingReasons ?? [],
          dryRunHash: dryRun.dryRunHash,
          summary: dryRun.summary,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          type: 'dry-run-result',
        },
      ]
      onMessages?.(nextMessages)
      return { messages: nextMessages, status: 'paused_for_approval' }
    }

    if (!shouldContinue) {
      return { messages: nextMessages, status: 'completed' }
    }
  }

  return { messages: nextMessages, status: 'completed' }
}

function compileTurnMessages(
  messages: AgentPersistedMessage[],
  systemPrompt?: string,
) {
  const compiled = compileAgentMessages(messages)
  const content = systemPrompt?.trim()
  if (!content) return compiled

  return [
    { role: 'system' as const, content },
    ...compiled.filter(
      (message) =>
        message.role !== 'system' || message.content?.trim() !== content,
    ),
  ]
}

async function collectAssistantTurn(
  events: AsyncIterable<AiAgentSseEvent>,
  options?: {
    baseMessages: AgentPersistedMessage[]
    onMessages?: (messages: AgentPersistedMessage[]) => void
  },
) {
  const textParts: string[] = []
  const thinkingParts: string[] = []
  const toolCalls: AgentToolCall[] = []
  const activeToolCalls = new Map<
    number,
    {
      arguments: Record<string, unknown>
      id?: string
      name?: string
    }
  >()

  for await (const event of events) {
    if (event.type === 'text_delta') {
      textParts.push(event.delta)
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      continue
    }
    if (event.type === 'thinking_delta') {
      thinkingParts.push(event.delta)
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      continue
    }
    if (event.type === 'toolcall_start') {
      activeToolCalls.set(event.contentIndex, {
        arguments: {},
        name: event.name,
      })
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      continue
    }
    if (event.type === 'toolcall_delta') {
      const current = activeToolCalls.get(event.contentIndex) ?? {
        arguments: {},
      }
      activeToolCalls.set(event.contentIndex, {
        ...current,
        arguments: {
          ...current.arguments,
          ...event.partialArgs,
        },
      })
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      continue
    }
    if (event.type === 'toolcall_end') {
      activeToolCalls.delete(event.contentIndex)
      toolCalls.push({
        arguments: event.toolCall.arguments ?? {},
        id: event.toolCall.id,
        name: event.toolCall.name,
      })
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      continue
    }
    if (event.type === 'error') {
      textParts.push(event.message)
      emitAssistantSnapshot(options, {
        activeToolCalls,
        text: textParts.join(''),
        thinking: thinkingParts.join(''),
        toolCalls,
      })
      break
    }
  }

  return { text: textParts.join(''), toolCalls }
}

function emitAssistantSnapshot(
  options:
    | {
        baseMessages: AgentPersistedMessage[]
        onMessages?: (messages: AgentPersistedMessage[]) => void
      }
    | undefined,
  state: {
    activeToolCalls: Map<
      number,
      {
        arguments: Record<string, unknown>
        id?: string
        name?: string
      }
    >
    text: string
    thinking: string
    toolCalls: AgentToolCall[]
  },
) {
  if (!options?.onMessages) return

  const transientMessages: AgentPersistedMessage[] = []
  if (state.thinking.length > 0) {
    transientMessages.push({
      content: state.thinking,
      streaming: true,
      type: 'thinking',
    })
  }
  if (state.text.length > 0) {
    transientMessages.push({
      content: state.text,
      streaming: true,
      type: 'assistant',
    })
  }
  for (const toolCall of state.toolCalls) {
    transientMessages.push({
      arguments: toolCall.arguments,
      content: toolCall.name,
      streaming: true,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      type: 'tool_call',
    })
  }
  for (const [contentIndex, toolCall] of state.activeToolCalls) {
    transientMessages.push({
      arguments: toolCall.arguments,
      content: toolCall.name ?? '',
      streaming: true,
      toolCallId: `pending-${contentIndex}`,
      toolName: toolCall.name,
      type: 'tool_call',
    })
  }

  if (transientMessages.length === 0) return
  options.onMessages([...options.baseMessages, ...transientMessages])
}

function appendToolResult(
  messages: AgentPersistedMessage[],
  toolCall: AgentToolCall,
  result: AgentToolHandlerResult,
) {
  return [
    ...messages,
    {
      content: result.content,
      isError: Boolean(result.isError),
      role: 'tool_result',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
    },
  ]
}

function hasToolResult(messages: AgentPersistedMessage[], toolCallId: string) {
  return messages.some(
    (message) =>
      message.role === 'tool_result' && message.toolCallId === toolCallId,
  )
}
