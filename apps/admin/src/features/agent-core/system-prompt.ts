import type { AgentSceneDefinition } from './contracts'
import type { AgentToolDefinition } from './turn-loop'

const CORE_POLICY_VERSION = 'admin-agent-core-2026-06-01'

export function buildAgentSystemPrompt(scene: AgentSceneDefinition) {
  return [
    `Policy version: ${CORE_POLICY_VERSION}.`,
    'You are the Mx Space admin agent. Help the administrator inspect and operate site data through the frontend-controlled tool layer.',
    describeRuntimeContext(scene),
    'Use tools for admin data access. Do not invent ids, counts, moderation states, or write results when a tool can provide them.',
    'Read tools may be called directly and their results may be used to continue the same turn.',
    'Write-capable tools are proposal tools. First request a dry run, explain the impact, and wait for explicit user approval before any execution result can be treated as applied.',
    'No dry-run means no write. No approval means no write. Never claim that a write has been applied until an execute-result or tool_result confirms it.',
    'Prefer concise operational answers. When data is incomplete, ask for the missing constraint or use a read tool to discover it.',
    'Available frontend tools:',
    ...scene.tools.map(describeTool),
  ].join('\n')
}

function describeRuntimeContext(scene: AgentSceneDefinition) {
  const { context } = scene
  const parts = [`Runtime scene: ${context.scene}.`, `Host: ${context.host}.`]

  if (context.originRoute) {
    parts.push(`Origin route: ${context.originRoute}.`)
  }
  if (context.originResource) {
    const resource = context.originResource
    parts.push(
      `Origin resource: ${resource.type} ${resource.id}${
        resource.title ? ` (${resource.title})` : ''
      }.`,
    )
    if (resource.summary) {
      parts.push(`Resource summary: ${resource.summary}.`)
    }
  }

  return parts.join(' ')
}

function describeTool(tool: AgentToolDefinition) {
  const mode =
    tool.kind === 'read'
      ? 'read'
      : tool.execute
        ? 'write-after-dry-run'
        : 'dry-run-only'

  return `- ${tool.manifest.name} [${mode}]: ${tool.manifest.description}`
}
