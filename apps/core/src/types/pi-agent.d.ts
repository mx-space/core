declare module '@mariozechner/pi-agent-core' {
  export interface AgentMessage {
    role: 'user' | 'assistant' | 'toolResult' | 'system'
    content: Array<{ type: string; text?: string }>
    timestamp?: number
    [key: string]: any
  }

  export interface AgentTool<_T = any> {
    name: string
    label?: string
    description?: string
    parameters?: _T
    execute: (toolCallId: string, params: any) => Promise<any>
  }

  export class Agent {
    constructor(config: any)
    prompt(message: AgentMessage): Promise<void>
    continue(): Promise<void>
    abort(): void
    subscribe(callback: (event: any) => void): () => void
  }
}

declare module '@mariozechner/pi-ai' {
  export const Type: any
  export type Static<_T> = any
  export interface Model<_T = any> {
    [key: string]: any
  }
}
