// ──────────────── Enums (mirror core) ────────────────

export enum AIProviderType {
  OpenAI = 'openai',
  OpenAICompatible = 'openai-compatible',
  Anthropic = 'anthropic',
  OpenRouter = 'openrouter',
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

export enum AIAgentActionState {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
  Executed = 'executed',
  Cancelled = 'cancelled',
}

export enum AIAgentActionRiskLevel {
  Safe = 'safe',
  Dangerous = 'dangerous',
}

export enum BusinessEvents {
  AI_AGENT_MESSAGE = 'AI_AGENT_MESSAGE',
  AI_AGENT_TOOL_EVENT = 'AI_AGENT_TOOL_EVENT',
  AI_AGENT_CONFIRM_REQUEST = 'AI_AGENT_CONFIRM_REQUEST',
  AI_AGENT_CONFIRM_RESULT = 'AI_AGENT_CONFIRM_RESULT',
  AI_AGENT_SESSION_STATE = 'AI_AGENT_SESSION_STATE',
}

// ──────────────── REST types (snake_case from JSONTransformInterceptor) ────────────────

export interface AIProviderConfig {
  id: string
  name: string
  type: AIProviderType
  api_key: string
  endpoint?: string
  default_model: string
  enabled: boolean
}

export interface AIModelAssignment {
  provider_id: string
  model?: string
}

export interface AIAgentRuntimeConfig {
  providers: AIProviderConfig[]
  agent_model?: AIModelAssignment
  enabled_tools: AIAgentToolId[]
}

export type AIAgentToolId = 'mongodb' | 'shell'

export interface AIAgentSession {
  id: string
  title: string
  status: AIAgentSessionStatus
  created: string
  updated: string
}

export interface AIAgentMessage {
  id: string
  session_id: string
  seq: number
  role: string
  kind: AIAgentMessageKind
  content: unknown
  created: string
}

export interface AIAgentAction {
  id: string
  session_id: string
  tool_name: string
  arguments: Record<string, unknown>
  risk_level: AIAgentActionRiskLevel
  state: AIAgentActionState
  result?: unknown
  error?: string
  dry_run_preview?: Record<string, unknown>
  created: string
  updated: string
}

export interface PaginatedMessages {
  data: AIAgentMessage[]
  pagination: {
    total: number
    page: number
    size: number
    total_page: number
    has_next_page: boolean
    has_prev_page: boolean
  }
}

export interface GetSessionResponse extends AIAgentSession {
  pending_actions?: AIAgentAction[]
}

// ──────────────── WS types (camelCase, raw from gateway) ────────────────

export interface WsEnvelope<T = unknown> {
  type: BusinessEvents
  data: T
}

export interface WsSessionState {
  sessionId: string
  state: 'running' | 'idle'
}

export interface WsMessageDelta {
  sessionId: string
  kind: 'assistant_delta'
  delta: string
}

export interface WsMessageFull {
  sessionId: string
  kind: AIAgentMessageKind
  message: AIAgentMessage
}

export type WsMessagePayload = WsMessageDelta | WsMessageFull

export interface WsToolEvent {
  sessionId: string
  event: {
    type:
      | 'tool_execution_start'
      | 'tool_execution_update'
      | 'tool_execution_end'
    toolName?: string
    toolUseId?: string
    input?: unknown
    output?: unknown
    error?: string
  }
}

export interface WsConfirmRequest {
  actionId: string
  sessionId: string
  toolName: string
  arguments: Record<string, unknown>
  riskLevel: AIAgentActionRiskLevel
  dryRunPreview?: Record<string, unknown>
}

export interface WsConfirmResult {
  actionId: string
  state: AIAgentActionState
  toolName: string
  result?: unknown
  error?: string
}
