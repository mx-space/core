export interface SandboxExecuteOptions {
  code: string
  context: SandboxContext
  timeout?: number
  memoryLimit?: number
}

export interface SandboxContext {
  req: unknown
  res: unknown
  isAuthenticated: boolean
  secret?: Record<string, unknown>
  model: {
    id: string
    name: string
    reference: string
  }
}

export interface SandboxResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    name: string
    message: string
    stack?: string
  }
  executionTime: number
}

export enum WorkerMessageType {
  Execute = 'execute',
  Result = 'result',
  Error = 'error',
  RequireRequest = 'require_request',
  RequireResponse = 'require_response',
  BridgeCall = 'bridge_call',
  BridgeResponse = 'bridge_response',
  Terminate = 'terminate',
}

export interface WorkerMessage {
  id: string
  type: WorkerMessageType
  payload: unknown
}

export interface ExecutePayload {
  code: string
  context: SandboxContext
  timeout: number
  namespace: string
}

export interface RequireRequestPayload {
  moduleId: string
  useCache: boolean
}

export interface BridgeCallPayload {
  method: string
  args: unknown[]
}
