import type { TSchema } from '@earendil-works/pi-ai'
import { Value } from 'typebox/value'

export interface EngineToolResult {
  content: string
  isError?: boolean
}

export interface EngineTool {
  name: string
  description: string
  parameters: TSchema
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<EngineToolResult>
}

export function firstSchemaFailure(schema: TSchema, value: unknown): string {
  const [first] = [...Value.Errors(schema, value)]
  if (!first) return 'unknown validation failure'
  return `${first.instancePath || '/'}: ${first.message}`
}
