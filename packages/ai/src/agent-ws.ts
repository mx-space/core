import type { AiAgentSseEvent } from './ai-agent-sse'

export const AgentWsEvents = {
  run: 'agent.run',
  toolResult: 'agent.tool.result',
  cancel: 'agent.cancel',
  steer: 'agent.steer',
  event: 'agent.event',
  toolCall: 'agent.tool.call',
  done: 'agent.done',
} as const

export interface AgentToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface AgentFileSnapshot {
  path: string
  content: string
  attach?: boolean
}

export interface AgentRunPayload {
  runId: string
  sessionId: string
  conversationId: string | null
  model: string
  providerId: string
  system: string[]
  user: string
  tools: AgentToolSchema[]
  files: AgentFileSnapshot[]
}

export interface AgentToolResultPayload {
  runId: string
  toolCallId: string
  content: string
  isError: boolean
  files?: AgentFileSnapshot[]
}

export interface AgentSteerPayload {
  runId: string
  user: string
  files: AgentFileSnapshot[]
}

export interface AgentCancelPayload {
  runId: string
}

export type AgentServerEvent =
  | AiAgentSseEvent
  | {
      type: 'tool_result'
      toolCallId: string
      name: string
      content: string
      isError: boolean
    }
  | { type: 'reminder'; paths: string[] }

export interface AgentEventPayload {
  runId: string
  event: AgentServerEvent
}

export interface AgentToolCallPayload {
  runId: string
  toolCallId: string
  name: string
  arguments: Record<string, unknown>
}

export type AgentRunStatus = 'complete' | 'aborted' | 'failed'

export interface AgentDonePayload {
  runId: string
  status: AgentRunStatus
  error?: string
}
