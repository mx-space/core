import type { Static, TSchema } from '@earendil-works/pi-ai'
import { Value } from 'typebox/value'

import type { IModelRuntime, ReasoningEffort } from '../../runtime'
import { firstSchemaFailure } from './tool.types'

export interface SubAgentSpec {
  runtime: IModelRuntime
  systemPrompt: string
  reasoningEffort?: ReasoningEffort
  timeoutMs?: number
}

const DEFAULT_SUB_AGENT_TIMEOUT_MS = 180_000

export async function invokeSubAgent<T extends TSchema>(
  spec: SubAgentSpec,
  input: { prompt: string; schema: T; signal?: AbortSignal },
): Promise<Static<T>> {
  const signals = [
    AbortSignal.timeout(spec.timeoutMs ?? DEFAULT_SUB_AGENT_TIMEOUT_MS),
  ]
  if (input.signal) signals.push(input.signal)
  const result = await spec.runtime.generateStructured({
    systemPrompt: spec.systemPrompt,
    prompt: input.prompt,
    schema: input.schema,
    reasoningEffort: spec.reasoningEffort,
    signal: AbortSignal.any(signals),
    validate: false,
  })
  if (!Value.Check(input.schema, result.output)) {
    throw new Error(
      `sub-agent output validation failed at ${firstSchemaFailure(input.schema, result.output)}`,
    )
  }
  return result.output as Static<T>
}
