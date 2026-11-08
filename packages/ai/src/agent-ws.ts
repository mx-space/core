import type { AiAgentSseEvent } from './ai-agent-sse'

export const AGENT_ATTACHMENTS_DIR = '/attachments/'

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

export type AgentFileFrame =
  | { path: string; attach?: boolean; content: string }
  | { path: string; attach?: boolean; baseHash: string; patch: string }
  | { path: string; attach?: boolean; hash: string }

export interface AgentRunPayload {
  runId: string
  sessionId: string
  conversationId: string | null
  model: string
  providerId: string
  user: string
  systemHash: string
  system?: string[]
  toolsHash: string
  tools?: AgentToolSchema[]
  files: AgentFileFrame[]
  images?: AgentToolImage[]
}

export interface ResolvedAgentRun {
  runId: string
  sessionId: string
  conversationId: string
  model: string
  providerId: string
  user: string
  system: string[]
  tools: AgentToolSchema[]
  files: AgentFileSnapshot[]
  images?: AgentToolImage[]
}

export type AgentRunAck =
  | { ok: true; conversationId: string }
  | { ok: false; code: 'CONTEXT_MISSING'; missing: Array<'system' | 'tools'> }
  | { ok: false; code: 'FILE_BASE_MISMATCH'; paths: string[] }
  | { ok: false; code: string }

export interface AgentToolImage {
  url: string
  mimeType?: string
}

export interface AgentToolResultPayload {
  runId: string
  toolCallId: string
  content: string
  isError: boolean
  files?: AgentFileFrame[]
  images?: AgentToolImage[]
}

export interface AgentSteerPayload {
  runId: string
  user: string
  files: AgentFileFrame[]
  images?: AgentToolImage[]
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

export type AgentToolCallStatus = 'running' | 'completed' | 'error'

export interface AgentHistoryToolItem {
  id: string
  toolName: string
  params: Record<string, unknown>
  status: AgentToolCallStatus
  result?: string
  resultPreview?: string
  error?: string
  truncated?: boolean
}

export interface AgentHistoryUsage {
  calls: number
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  cost: number
}

export type AgentHistoryBubble =
  | {
      type: 'user'
      content: string
      images?: AgentToolImage[]
      files?: string[]
    }
  | { type: 'assistant'; content: string; usage?: AgentHistoryUsage }
  | {
      type: 'thinking'
      id: string
      content: string
      rawText: string
      steps: string[]
    }
  | { type: 'tool_call_group'; id: string; items: AgentHistoryToolItem[] }
  | { type: 'diff_review'; batchId: string }
