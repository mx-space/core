import type { AIAgentToolManifest } from '../../connector.types'

export const mongoToolManifest: AIAgentToolManifest = {
  id: 'mongodb',
  name: 'mongodb',
  label: 'MongoDB',
  description:
    'Access MongoDB collections. Write operations require explicit user confirmation before execution.',
  defaultEnabled: true,
}
