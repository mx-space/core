import type {
  FauxModelDefinition,
  FauxProviderRegistration,
  FauxResponseStep,
} from '@earendil-works/pi-ai'
import { registerFauxProvider } from '@earendil-works/pi-ai/compat'

export interface WithFauxAiOptions {
  api?: string
  provider?: string
  models?: FauxModelDefinition[]
  responses?: FauxResponseStep[]
  tokensPerSecond?: number
  tokenSize?: { min?: number; max?: number }
}

export interface FauxAiHandle {
  registration: FauxProviderRegistration
  teardown: () => void
}

/**
 * Thin wrapper around pi-ai `registerFauxProvider` for use in unit / faux-e2e
 * tests. Returns the live registration plus an idempotent `teardown` that
 * removes the faux provider from the registry once the test completes.
 */
export function withFauxAi(options: WithFauxAiOptions = {}): FauxAiHandle {
  const registration = registerFauxProvider({
    api: options.api,
    provider: options.provider,
    models: options.models,
    tokensPerSecond: options.tokensPerSecond,
    tokenSize: options.tokenSize,
  })

  if (options.responses?.length) {
    registration.setResponses(options.responses)
  }

  let torn = false
  return {
    registration,
    teardown() {
      if (torn) return
      torn = true
      registration.unregister()
    },
  }
}
