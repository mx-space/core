import type { AIAgentToolManifest } from '../../connector.types'

export const shellToolManifest: AIAgentToolManifest = {
  id: 'shell',
  name: 'shell',
  label: 'Shell',
  description:
    'Execute shell commands. Whitelisted read-only commands run directly; other commands require explicit user confirmation.',
  defaultEnabled: true,
}
