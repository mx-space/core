import {
  Agent,
  type AgentMessage,
  type AgentTool,
} from '@mariozechner/pi-agent-core'
import type { Model } from '@mariozechner/pi-ai'
import { Injectable } from '@nestjs/common'

import { AIAgentOperationMode } from '../ai-agent.types'

interface ExecuteLoopInput {
  mode: AIAgentOperationMode
  prompt?: string
  maxSteps: number
  model: Model<any>
  getApiKey: (providerName: string) => string | undefined
  messages: AgentMessage[]
  tools: AgentTool<any>[]
  systemPrompt: string
  onDelta: (delta: string) => Promise<void>
  onToolEvent: (event: Record<string, unknown>) => Promise<void>
  onMessage: (message: AgentMessage) => Promise<void>
}

interface ExecuteLoopResult {
  pausedForHuman: boolean
  reason: 'completed' | 'waiting_human' | 'max_steps'
  stepCount: number
}

@Injectable()
export class AIAgentRuntimeService {
  async executeLoop(input: ExecuteLoopInput): Promise<ExecuteLoopResult> {
    const agent = new Agent({
      initialState: {
        systemPrompt: input.systemPrompt,
        model: input.model,
        messages: input.messages,
        tools: input.tools,
      },
      getApiKey: input.getApiKey,
      transport: 'websocket',
      maxRetryDelayMs: 60_000,
    })

    let pausedForHuman = false
    let reachedMaxSteps = false
    let turnCount = 0
    let persistQueue = Promise.resolve()
    let hasPersistedAssistantOrToolMessage = false

    const unsubscribe = agent.subscribe((event) => {
      if (this.isPendingConfirmationToolEvent(event) && !pausedForHuman) {
        pausedForHuman = true
        agent.abort()
      }

      if (this.isTurnEndEvent(event)) {
        turnCount += 1
        if (
          !pausedForHuman &&
          !reachedMaxSteps &&
          turnCount >= input.maxSteps
        ) {
          reachedMaxSteps = true
          agent.abort()
        }
      }

      persistQueue = persistQueue.then(async () => {
        switch (event.type) {
          case 'message_update': {
            if (event.assistantMessageEvent.type === 'text_delta') {
              await input.onDelta(event.assistantMessageEvent.delta)
            }
            break
          }

          case 'message_end': {
            if (
              event.message.role === 'assistant' ||
              event.message.role === 'toolResult'
            ) {
              if (
                (pausedForHuman || reachedMaxSteps) &&
                event.message.role === 'assistant' &&
                this.isAbortAssistantMessage(event.message)
              ) {
                break
              }

              hasPersistedAssistantOrToolMessage = true
              await input.onMessage(event.message)
            }
            break
          }

          case 'agent_end': {
            if (hasPersistedAssistantOrToolMessage) {
              break
            }

            const lastMessage = event.messages.at(-1)
            if (
              lastMessage?.role === 'assistant' &&
              !(
                (pausedForHuman || reachedMaxSteps) &&
                this.isAbortAssistantMessage(lastMessage)
              )
            ) {
              await input.onMessage(lastMessage)
              hasPersistedAssistantOrToolMessage = true
            }
            break
          }

          case 'tool_execution_start':
          case 'tool_execution_update':
          case 'tool_execution_end': {
            await input.onToolEvent(event as unknown as Record<string, unknown>)
            break
          }
        }
      })
    })

    try {
      if (input.mode === AIAgentOperationMode.Prompt) {
        const promptMessage: AgentMessage = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: input.prompt || '',
            },
          ],
          timestamp: Date.now(),
        }
        await agent.prompt(promptMessage)
      } else {
        await agent.continue()
      }

      await persistQueue

      if (pausedForHuman) {
        return {
          pausedForHuman: true,
          reason: 'waiting_human',
          stepCount: turnCount,
        }
      }

      if (reachedMaxSteps) {
        return {
          pausedForHuman: false,
          reason: 'max_steps',
          stepCount: turnCount,
        }
      }

      return {
        pausedForHuman: false,
        reason: 'completed',
        stepCount: turnCount,
      }
    } finally {
      unsubscribe()
    }
  }

  private isTurnEndEvent(event: unknown) {
    return Boolean(
      event && typeof event === 'object' && (event as any).type === 'turn_end',
    )
  }

  private isPendingConfirmationToolEvent(event: unknown) {
    if (!event || typeof event !== 'object') {
      return false
    }

    if ((event as any).type !== 'tool_execution_end') {
      return false
    }

    const details = (event as any).result?.details
    return Boolean(
      details &&
      typeof details === 'object' &&
      (details as Record<string, unknown>).pendingConfirmation === true,
    )
  }

  private isAbortAssistantMessage(message: AgentMessage) {
    if (message.role !== 'assistant') {
      return false
    }

    const stopReason = (message as any).stopReason
    if (stopReason !== 'aborted') {
      return false
    }

    const errorMessage = (message as any).errorMessage
    if (typeof errorMessage !== 'string') {
      return true
    }

    return /aborted/i.test(errorMessage)
  }
}
