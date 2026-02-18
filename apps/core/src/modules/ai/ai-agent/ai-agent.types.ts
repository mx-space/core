import type { AIModelAssignment, AIProviderConfig } from '../ai.types'

export const AGENT_SESSION_ROOM_PREFIX = 'session:'
export const BUILTIN_AGENT_TOOL_IDS = ['mongodb', 'shell'] as const
export type AIAgentToolId = (typeof BUILTIN_AGENT_TOOL_IDS)[number]

export function getAgentSessionRoom(sessionId: string) {
  return `${AGENT_SESSION_ROOM_PREFIX}${sessionId}`
}

export interface AIAgentRuntimeConfigValue {
  providers: AIProviderConfig[]
  agentModel?: AIModelAssignment
  enabledTools: AIAgentToolId[]
}

export enum AIAgentSessionStatus {
  Active = 'active',
  Closed = 'closed',
}

export enum AIAgentMessageKind {
  User = 'user',
  Assistant = 'assistant',
  ToolResult = 'tool_result',
  ConfirmRequest = 'confirm_request',
  ConfirmResult = 'confirm_result',
}

export enum AIAgentActionRiskLevel {
  Safe = 'safe',
  Dangerous = 'dangerous',
}

export enum AIAgentActionState {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
  Executed = 'executed',
  Cancelled = 'cancelled',
}

export interface AIAgentToolActionArgument {
  [key: string]: unknown
}

export interface AIAgentToolResult {
  content: Array<{ type: 'text'; text: string }>
  details: Record<string, unknown>
}
