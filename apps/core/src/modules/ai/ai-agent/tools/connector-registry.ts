import { BUILTIN_AGENT_TOOL_IDS, type AIAgentToolId } from '../ai-agent.types'
import type { AIAgentToolConnector } from './connector.types'

export function createConnectorRegistry(connectors: AIAgentToolConnector[]) {
  const registry = new Map<AIAgentToolId, AIAgentToolConnector>()

  for (const connector of connectors) {
    registry.set(connector.manifest.id, connector)
  }

  return registry
}

export function normalizeEnabledToolIds(
  enabledTools: readonly string[] | null | undefined,
  registry: Map<AIAgentToolId, AIAgentToolConnector>,
) {
  if (!Array.isArray(enabledTools)) {
    return Array.from(registry.values())
      .filter((connector) => connector.manifest.defaultEnabled)
      .map((connector) => connector.manifest.id)
  }

  const normalized = Array.from(
    new Set(
      enabledTools.filter((id): id is AIAgentToolId => {
        const toolId = id as AIAgentToolId
        return BUILTIN_AGENT_TOOL_IDS.includes(toolId) && registry.has(toolId)
      }),
    ),
  )

  return normalized
}

export function resolveEnabledConnectors(
  enabledTools: readonly AIAgentToolId[],
  registry: Map<AIAgentToolId, AIAgentToolConnector>,
) {
  return enabledTools
    .map((toolId) => registry.get(toolId))
    .filter((connector): connector is AIAgentToolConnector =>
      Boolean(connector),
    )
}
