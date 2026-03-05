import type { Model } from '@mariozechner/pi-ai'
import { Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'

import { type AIProviderConfig, AIProviderType } from '../../ai.types'
import type { AIAgentRuntimeConfigValue } from '../ai-agent.types'

@Injectable()
export class AIAgentModelFactoryService {
  resolvePiModel(config: AIAgentRuntimeConfigValue): {
    model: Model<any>
    selectedProvider: AIProviderConfig
  } {
    const enabledProviders = (config.providers || []).filter((provider) => {
      return provider.enabled && provider.apiKey?.trim()
    })

    if (!enabledProviders.length) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'No enabled provider with API key configured for AI agent',
      )
    }

    let selectedProvider: AIProviderConfig | undefined
    if (config.agentModel?.providerId) {
      selectedProvider = enabledProviders.find(
        (provider) => provider.id === config.agentModel!.providerId,
      )
    }

    selectedProvider ||= enabledProviders[0]

    const selectedModel =
      config.agentModel?.model?.trim() || selectedProvider.defaultModel

    const baseCost = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }

    switch (selectedProvider.type) {
      case AIProviderType.Anthropic: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'anthropic-messages',
            provider: 'anthropic',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://api.anthropic.com/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 200_000,
            maxTokens: 8_192,
          },
          selectedProvider,
        }
      }

      case AIProviderType.OpenRouter: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: 'openrouter',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://openrouter.ai/api/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }

      case AIProviderType.OpenAICompatible: {
        const endpoint = this.normalizeEndpoint(selectedProvider.endpoint)
        if (!endpoint) {
          throw new BizException(
            ErrorCodeEnum.InvalidParameter,
            `Endpoint is required for provider: ${selectedProvider.id}`,
          )
        }
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: selectedProvider.id,
            baseUrl: endpoint,
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }

      default: {
        return {
          model: {
            id: selectedModel,
            name: selectedModel,
            api: 'openai-completions',
            provider: 'openai',
            baseUrl:
              this.normalizeEndpoint(selectedProvider.endpoint) ||
              'https://api.openai.com/v1',
            reasoning: true,
            input: ['text', 'image'],
            cost: baseCost,
            contextWindow: 128_000,
            maxTokens: 16_384,
          },
          selectedProvider,
        }
      }
    }
  }

  createApiKeyResolver(providers: AIProviderConfig[]) {
    const enabledProviders = (providers || [])
      .filter((provider) => provider.enabled && provider.apiKey?.trim())
      .map((provider) => ({
        ...provider,
        apiKey: provider.apiKey.trim(),
      }))

    const keyByProviderId = new Map(
      enabledProviders.map((provider) => [provider.id, provider.apiKey]),
    )
    const keyByProviderType = new Map<AIProviderType, string>()

    for (const provider of enabledProviders) {
      if (!keyByProviderType.has(provider.type)) {
        keyByProviderType.set(provider.type, provider.apiKey)
      }
    }

    return (providerName: string) => {
      if (!providerName) {
        return undefined
      }

      if (keyByProviderId.has(providerName)) {
        return keyByProviderId.get(providerName)
      }

      switch (providerName) {
        case 'openrouter': {
          return keyByProviderType.get(AIProviderType.OpenRouter)
        }
        case 'anthropic': {
          return keyByProviderType.get(AIProviderType.Anthropic)
        }
        case 'openai': {
          return (
            keyByProviderType.get(AIProviderType.OpenAI) ||
            keyByProviderType.get(AIProviderType.OpenAICompatible)
          )
        }
        default: {
          return undefined
        }
      }
    }
  }

  normalizeEndpoint(endpoint?: string) {
    if (!endpoint) {
      return undefined
    }

    let normalized = endpoint.trim().replace(/\/+$/, '')
    if (!normalized.endsWith('/v1')) {
      normalized = `${normalized}/v1`
    }
    return normalized
  }
}
