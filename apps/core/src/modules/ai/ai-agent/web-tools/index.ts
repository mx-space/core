import { deriveProviderId } from '@mx-space/ai/runtime'

import type { AIProviderConfig } from '~/modules/ai/ai.types'
import { AIProviderType } from '~/modules/ai/ai.types'

import { createDeepSeekProfile } from './deepseek'
import { openRouterProfile } from './openrouter'
import type { WebToolProfile } from './web-tools.types'

export * from './web-tools.types'

/**
 * Web tools come from the provider the agent runs on; providers without a
 * profile get none, and their request payloads stay untouched.
 */
export function resolveWebToolProfile(
  provider: Pick<AIProviderConfig, 'type' | 'endpoint' | 'apiKey'>,
): WebToolProfile | undefined {
  if (!provider.endpoint?.trim()) return undefined
  switch (deriveProviderId(provider.endpoint, provider.type)) {
    case 'openrouter': {
      return provider.type === AIProviderType.OpenAICompatible
        ? openRouterProfile
        : undefined
    }
    case 'deepseek': {
      return createDeepSeekProfile(provider.apiKey)
    }
    default: {
      return undefined
    }
  }
}
