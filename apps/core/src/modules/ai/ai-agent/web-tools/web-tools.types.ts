import type { AgentServerTool } from '../ai-agent-server-tools'

/** Web searches + page fetches allowed per agent run, across all providers. */
export const WEB_TOOL_RUN_LIMIT = 20

export interface WebToolSource {
  url: string
  title?: string
}

/** One provider-executed search the run surfaces to the client. */
export interface WebToolActivity {
  kind: 'web_search'
  sources: WebToolSource[]
}

export interface WebToolBudget {
  /** Claims one call; false once the run's limit is spent. */
  take: () => boolean
}

export interface OpenRouterObserver {
  /** Feeds one raw provider chunk; returns activities completed by it. */
  push: (chunk: unknown) => WebToolActivity[]
  /** Emits any pending activity at the end of a model call. */
  flush: () => WebToolActivity[]
  /** Server tool calls OpenRouter reported as executed for this model call. */
  readonly executed: number
}

export type WebToolProfile =
  | {
      id: 'openrouter'
      /** Provider runs the tools; core only injects and observes. */
      kind: 'inject'
      providerTools: Record<string, unknown>[]
      createObserver: () => OpenRouterObserver
    }
  | {
      id: 'deepseek'
      /** Core runs the tools against the provider's own search API. */
      kind: 'function'
      createTools: (budget: WebToolBudget) => AgentServerTool[]
    }

export function createWebToolBudget(limit: number): WebToolBudget {
  let used = 0
  return {
    take: () => {
      if (used >= limit) return false
      used++
      return true
    },
  }
}
