import type {
  AgentEvent,
  AgentMessage,
  AgentTool,
  StreamFn,
} from '@earendil-works/pi-agent-core'
import { runAgentLoop as piRunAgentLoop } from '@earendil-works/pi-agent-core'
import type { AssistantMessage, Message } from '@earendil-works/pi-ai'

import type { IModelRuntime } from '../../runtime'
import type { Conversation } from '../conversation/conversation'
import type { EngineTool } from '../tools/tool.types'

export interface LoopGuards {
  maxSteps: number
  toolInvocationLimits?: Record<string, number>
}

export interface AgentLoopResult {
  finishReason: 'model-finished' | 'max-steps'
  steps: number
  toolInvocations: Record<string, number>
  totalCostUsd: number
}

export async function runEngineLoop(opts: {
  runtime: IModelRuntime
  conversation: Conversation
  tools: EngineTool[]
  guards: LoopGuards
  signal?: AbortSignal
  onToken?: () => Promise<void>
  onCost?: (usd: number) => Promise<void>
}): Promise<AgentLoopResult> {
  const { runtime, conversation, tools, guards, signal, onToken, onCost } = opts
  if (typeof runtime.streamMessage !== 'function') {
    throw new TypeError('runtime does not implement streamMessage')
  }

  const toolInvocations: Record<string, number> = {}
  let steps = 0
  let totalCostUsd = 0
  let stoppedByMaxSteps = false
  let lastTurnHadToolCalls = false
  let errorStop: AssistantMessage | null = null

  const agentTools: AgentTool[] = tools.map((tool) => ({
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (_toolCallId, params, execSignal) => {
      const result = await tool.execute(
        params as Record<string, unknown>,
        execSignal,
      )
      if (result.isError) throw new Error(result.content)
      return {
        content: [{ type: 'text', text: result.content }],
        details: undefined,
      }
    },
  }))

  const emit = async (event: AgentEvent) => {
    if (onToken) await onToken()
    if (event.type !== 'turn_end') return
    const message = event.message as AssistantMessage
    if (message.role !== 'assistant') return
    steps++
    lastTurnHadToolCalls = message.content.some(
      (block) => block.type === 'toolCall',
    )
    conversation.appendAssistant(message)
    for (const result of event.toolResults) {
      conversation.append(result)
    }
    const cost = message.usage?.cost?.total ?? 0
    totalCostUsd += cost
    if (onCost && cost > 0) await onCost(cost)
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      errorStop = message
    }
  }

  const streamFn: StreamFn = (_model, context, options) =>
    runtime.streamMessage!({
      messages: context.messages,
      systemPrompt: context.systemPrompt,
      tools: context.tools,
      signal: options?.signal ?? signal,
    })

  await piRunAgentLoop(
    [],
    {
      systemPrompt: conversation.systemPrompt,
      messages: conversation.messages as AgentMessage[],
      tools: agentTools,
    },
    {
      model: {
        provider: runtime.providerInfo.id,
        id: runtime.providerInfo.model,
      } as never,
      convertToLlm: (messages) => messages as Message[],
      transformContext: conversation.transformContext,
      toolExecution: 'sequential',
      beforeToolCall: async ({ toolCall }) => {
        const limit = guards.toolInvocationLimits?.[toolCall.name]
        if (
          limit !== undefined &&
          (toolInvocations[toolCall.name] ?? 0) >= limit
        ) {
          return {
            block: true,
            reason: `Tool budget for ${toolCall.name} exhausted; finalize without further calls to it.`,
          }
        }
        toolInvocations[toolCall.name] =
          (toolInvocations[toolCall.name] ?? 0) + 1
        return undefined
      },
      shouldStopAfterTurn: () => {
        if (steps >= guards.maxSteps) {
          stoppedByMaxSteps = true
          return true
        }
        return false
      },
    },
    emit,
    signal,
    streamFn,
  )

  if (errorStop) {
    const failed = errorStop as AssistantMessage
    if (failed.stopReason === 'aborted' || signal?.aborted) {
      throw new DOMException('aborted', 'AbortError')
    }
    throw new Error(failed.errorMessage ?? 'agent loop model call failed')
  }

  return {
    finishReason:
      stoppedByMaxSteps && lastTurnHadToolCalls
        ? 'max-steps'
        : 'model-finished',
    steps,
    toolInvocations,
    totalCostUsd,
  }
}
