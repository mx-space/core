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
  maxSteps: number
  historyWindow: number
  contextCharBudget: number
}

export enum AIAgentSessionStatus {
  Active = 'active',
  Closed = 'closed',
}

export enum AIAgentMessageKind {
  User = 'user',
  Assistant = 'assistant',
  ToolResult = 'tool_result',
  RuntimeError = 'runtime_error',
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

export enum AIAgentOperationMode {
  Prompt = 'prompt',
  Continue = 'continue',
}

export enum AIAgentOperationStatus {
  Queued = 'queued',
  Running = 'running',
  WaitingHuman = 'waiting_human',
  Done = 'done',
  Error = 'error',
  Cancelled = 'cancelled',
}

export enum AIAgentEventType {
  SessionState = 'session_state',
  MessageDelta = 'message_delta',
  MessagePersisted = 'message_persisted',
  ToolEvent = 'tool_event',
  ConfirmRequest = 'confirm_request',
  ConfirmResult = 'confirm_result',
  RuntimeError = 'runtime_error',
  Compression = 'compression',
}

export interface AIAgentToolActionArgument {
  [key: string]: unknown
}

export interface AIAgentToolResult {
  content: Array<{ type: 'text'; text: string }>
  details: Record<string, unknown>
}
