import type { AgentStore } from '@haklex/rich-agent-core'
import { createAgentStore } from '@haklex/rich-agent-core'

export function createManagedAgentStore(): AgentStore {
  return createAgentStore()
}
