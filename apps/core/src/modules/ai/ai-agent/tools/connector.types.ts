import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { AIAgentToolId } from '../ai-agent.types'

export interface AIAgentToolManifest {
  id: AIAgentToolId
  name: string
  label: string
  description: string
  defaultEnabled: boolean
}

export interface AIAgentToolSystemPrompt {
  purpose: string
  whenToUse: string[]
  usageRules: string[]
}

export interface AIAgentToolConnectorContext {
  sessionId: string
  seq: { value: number }
}

export interface AIAgentToolConnector {
  manifest: AIAgentToolManifest
  systemPrompt: AIAgentToolSystemPrompt
  createTool: (context: AIAgentToolConnectorContext) => AgentTool<any>
}

export function buildConnectorSystemPrompt(connector: AIAgentToolConnector) {
  const lines = [
    `Tool: ${connector.manifest.name}`,
    `Purpose: ${connector.systemPrompt.purpose}`,
  ]

  if (connector.systemPrompt.whenToUse.length > 0) {
    lines.push('When to use:')
    for (const item of connector.systemPrompt.whenToUse) {
      lines.push(`- ${item}`)
    }
  }

  if (connector.systemPrompt.usageRules.length > 0) {
    lines.push('Usage rules:')
    for (const item of connector.systemPrompt.usageRules) {
      lines.push(`- ${item}`)
    }
  }

  return lines.join('\n')
}
