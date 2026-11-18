import { resolveWebSearchVendor } from '@mx-space/ai'

import type { AIProviderConfig } from '~/modules/ai/ai.types'

import { createDeepSeekProfile } from './deepseek'
import { openRouterProfile } from './openrouter'
import type { WebToolProfile } from './web-tools.types'

export * from './web-tools.types'

/**
 * Web tools a provider can serve; providers without a built-in search get
 * none, and their request payloads stay untouched.
 */
export function resolveWebToolProfile(
  provider: Pick<AIProviderConfig, 'type' | 'endpoint' | 'apiKey'>,
): WebToolProfile | undefined {
  switch (resolveWebSearchVendor(provider)) {
    case 'openrouter': {
      return openRouterProfile
    }
    case 'deepseek': {
      return createDeepSeekProfile(provider.apiKey)
    }
    default: {
      return undefined
    }
  }
}
