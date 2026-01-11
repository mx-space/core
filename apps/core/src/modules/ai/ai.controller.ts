import { Body, Get, Param, Post } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { generateText } from 'ai'
import { ConfigsService } from '../configs/configs.service'
import { createLanguageModel } from './ai-provider.factory'
import { AIProviderType } from './ai.types'

// 用于临时测试获取模型列表的 DTO
interface FetchModelsDto {
  providerId?: string
  type?: AIProviderType
  apiKey?: string
  endpoint?: string
}

interface ModelInfo {
  id: string
  name: string
  created?: number
}

interface ProviderModelsResponse {
  providerId: string
  providerName: string
  providerType: AIProviderType
  models: ModelInfo[]
  error?: string
}

interface TestConnectionDto {
  providerId?: string
  type?: AIProviderType
  apiKey?: string
  endpoint?: string
  model?: string
}

// Anthropic 模型列表（Anthropic 没有公开的 models API，需要硬编码）
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODELS: ModelInfo[] = [
  // Claude 4.x 系列
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  // Claude 4.1 系列
  { id: 'claude-opus-4-1-20250414', name: 'Claude Opus 4.1' },
  // Claude 3.7 系列
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
  // Claude 3.5 系列
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  // Claude 3 系列
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
]

@ApiController('ai')
export class AiController {
  constructor(private readonly configsService: ConfigsService) {}

  /**
   * 获取所有已配置 Provider 的可用模型列表
   */
  @Get('/models')
  @Auth()
  async getAvailableModels(): Promise<ProviderModelsResponse[]> {
    const aiConfig = await this.configsService.get('ai')

    if (!aiConfig.providers?.length) {
      return []
    }

    const results: ProviderModelsResponse[] = []

    for (const provider of aiConfig.providers) {
      if (!provider.enabled || !provider.apiKey) {
        continue
      }

      try {
        const models = await this.fetchModelsForProvider(provider)
        results.push({
          providerId: provider.id,
          providerName: provider.name,
          providerType: provider.type,
          models,
        })
      } catch (error: any) {
        results.push({
          providerId: provider.id,
          providerName: provider.name,
          providerType: provider.type,
          models: [],
          error: error.message || 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * 获取模型列表（无需保存 Provider 配置）
   * 用于在配置页面预览可用模型
   */
  @Post('/models/list')
  @Auth()
  async fetchModelsList(
    @Body() body: FetchModelsDto,
  ): Promise<{ models: ModelInfo[]; error?: string }> {
    const { providerId, type, apiKey, endpoint } =
      await this.resolveModelListConfig(body)

    if (!type) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'Provider type is required',
      )
    }

    if (!apiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'API key is required')
    }

    try {
      const models = await this.fetchModelsForProvider({
        id: providerId || 'test',
        type,
        apiKey,
        endpoint,
      })
      return { models }
    } catch (error: any) {
      return {
        models: [],
        error: error.message || 'Unknown error',
      }
    }
  }

  /**
   * 测试 Provider 连接是否可用（发送简单对话）
   */
  @Post('/test')
  @Auth()
  async testProviderConnection(
    @Body() body: TestConnectionDto,
  ): Promise<{ ok: boolean }> {
    const { providerId } = body
    const { type, apiKey, endpoint, model } = await this.resolveTestConfig(body)

    if (!type) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'Provider type is required',
      )
    }

    if (!apiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'API key is required')
    }

    if (!model) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'Model is required')
    }

    try {
      const languageModel = createLanguageModel({
        id: providerId || 'test',
        name: providerId || 'test',
        type,
        apiKey,
        endpoint,
        defaultModel: model,
        enabled: true,
      })

      await generateText({
        model: languageModel as Parameters<typeof generateText>[0]['model'],
        prompt: 'Say "ok".',
        maxRetries: 0,
      })

      return { ok: true }
    } catch (error: any) {
      throw new BizException(
        ErrorCodeEnum.AIException,
        error?.message || 'AI test failed',
      )
    }
  }

  private async resolveModelListConfig(body: FetchModelsDto) {
    const needsLookup =
      !!body.providerId && (!body.apiKey || !body.type || !body.endpoint)
    const storedProvider = needsLookup
      ? await this.configsService.getAiProviderById(body.providerId)
      : undefined

    return {
      providerId: body.providerId,
      type: body.type ?? storedProvider?.type,
      apiKey: body.apiKey || storedProvider?.apiKey,
      endpoint: body.endpoint ?? storedProvider?.endpoint,
    }
  }

  private async resolveTestConfig(body: TestConnectionDto) {
    const needsLookup =
      !!body.providerId &&
      (!body.apiKey || !body.type || !body.endpoint || !body.model)
    const storedProvider = needsLookup
      ? await this.configsService.getAiProviderById(body.providerId)
      : undefined

    return {
      type: body.type ?? storedProvider?.type,
      apiKey: body.apiKey || storedProvider?.apiKey,
      endpoint: body.endpoint ?? storedProvider?.endpoint,
      model: body.model ?? storedProvider?.defaultModel,
    }
  }

  /**
   * 获取指定 Provider 的可用模型列表（已保存的 Provider）
   */
  @Get('/models/:providerId')
  @Auth()
  async getModelsForProvider(
    @Param('providerId') providerId: string,
  ): Promise<ProviderModelsResponse> {
    const aiConfig = await this.configsService.get('ai')
    const provider = aiConfig.providers?.find((p) => p.id === providerId)

    if (!provider) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFound,
        `Provider ${providerId} not found`,
      )
    }

    if (!provider.enabled) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        `Provider ${providerId} is not enabled`,
      )
    }

    if (!provider.apiKey) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        `Provider ${providerId} has no API key configured`,
      )
    }

    try {
      const models = await this.fetchModelsForProvider(provider)
      return {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.type,
        models,
      }
    } catch (error: any) {
      return {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.type,
        models: [],
        error: error.message || 'Unknown error',
      }
    }
  }

  private normalizeEndpoint(endpoint: string): string {
    // 移除末尾斜杠
    let normalized = endpoint.replace(/\/+$/, '')
    // 如果没有 /v1 后缀，添加它（对于 OpenAI 兼容服务）
    if (!normalized.endsWith('/v1')) {
      normalized = `${normalized}/v1`
    }
    return normalized
  }

  private async fetchModelsForProvider(provider: {
    id: string
    type: AIProviderType
    apiKey: string
    endpoint?: string
  }): Promise<ModelInfo[]> {
    switch (provider.type) {
      case AIProviderType.Anthropic:
        // Anthropic 没有公开的 models API，返回硬编码列表
        return ANTHROPIC_MODELS

      case AIProviderType.OpenAI:
      case AIProviderType.OpenAICompatible:
      case AIProviderType.OpenRouter: {
        let baseURL: string

        if (provider.type === AIProviderType.OpenAI) {
          // OpenAI 官方
          baseURL = provider.endpoint
            ? this.normalizeEndpoint(provider.endpoint)
            : 'https://api.openai.com/v1'
        } else if (provider.type === AIProviderType.OpenRouter) {
          // OpenRouter
          baseURL = provider.endpoint
            ? this.normalizeEndpoint(provider.endpoint)
            : 'https://openrouter.ai/api/v1'
        } else {
          // OpenAI 兼容服务
          if (!provider.endpoint) {
            throw new Error(
              'Endpoint is required for OpenAI-compatible provider',
            )
          }
          baseURL = this.normalizeEndpoint(provider.endpoint)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        try {
          const response = await fetch(`${baseURL}/models`, {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            throw new Error(
              `API returned ${response.status}: ${errorText.slice(0, 200)}`,
            )
          }

          const data = await response.json()
          const models: ModelInfo[] = (data.data || [])
            .filter((m: any) => {
              // 过滤掉非聊天模型
              const id = (m.id || '').toLowerCase()
              return (
                !id.includes('embedding') &&
                !id.includes('whisper') &&
                !id.includes('tts') &&
                !id.includes('dall-e') &&
                !id.includes('moderation') &&
                !id.includes('davinci') &&
                !id.includes('babbage') &&
                !id.includes('ada') &&
                !id.includes('curie')
              )
            })
            .map((m: any) => ({
              id: m.id,
              name: m.id,
              created: m.created,
            }))
            .sort((a: ModelInfo, b: ModelInfo) => {
              // 按创建时间倒序，最新的在前面
              return (b.created || 0) - (a.created || 0)
            })

          return models
        } catch (error: any) {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            throw new Error('Request timeout after 10s')
          }
          throw error
        }
      }

      default:
        return []
    }
  }
}
