import type { AgentToolDefinition } from './turn-loop'

export type AgentScene = 'general' | 'in-page'

export type AgentHost = 'floating-panel' | 'workbench'

export interface AgentRuntimeContext {
  host: AgentHost
  originResource?: {
    id: string
    summary?: string
    title?: string
    type: 'category' | 'comment' | 'note' | 'page' | 'post' | 'recently' | 'tag'
  }
  originRoute?: string
  scene: AgentScene
}

export interface AgentSceneDefinition {
  context: AgentRuntimeContext
  tools: AgentToolDefinition[]
}

export function createGeneralScene(
  tools: AgentToolDefinition[],
): AgentSceneDefinition {
  return {
    context: {
      host: 'workbench',
      scene: 'general',
    },
    tools,
  }
}

export function createInPageScene(options: {
  originResource: NonNullable<AgentRuntimeContext['originResource']>
  originRoute: string
  tools: AgentToolDefinition[]
}): AgentSceneDefinition {
  return {
    context: {
      host: 'floating-panel',
      originResource: options.originResource,
      originRoute: options.originRoute,
      scene: 'in-page',
    },
    tools: options.tools,
  }
}
