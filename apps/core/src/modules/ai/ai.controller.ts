import { Body, Get, Param, Post } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { OK_DATA } from '~/common/response/envelope.types'

import { ConfigsService } from '../configs/configs.service'
import { AI_PROMPTS } from './ai.prompts'
import { AiService } from './ai.service'
import { AIProviderType } from './ai.types'
import type { IModelRuntime, ModelInfo } from './runtime'
import { createModelRuntime, createRuntimeForModelList } from './runtime'

interface FetchModelsDto {
  providerId?: string
  type?: AIProviderType
  apiKey?: string
  endpoint?: string
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

interface TestCommentReviewDto {
  text: string
  author?: string
}

@ApiController('ai')
export class AiController {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly aiService: AiService,
  ) {}

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
        const runtime = createModelRuntime(provider)
        const models = await this.fetchModelsFromRuntime(runtime)
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

  @Post('/models/list')
  @Auth()
  async fetchModelsList(
    @Body() body: FetchModelsDto,
  ): Promise<{ models: ModelInfo[]; error?: string }> {
    const { type, apiKey, endpoint } = await this.resolveModelListConfig(body)

    if (!type) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'Provider type is required',
      })
    }

    if (!apiKey) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'API key is required',
      })
    }

    try {
      const runtime = createRuntimeForModelList(type, apiKey, endpoint)
      const models = await this.fetchModelsFromRuntime(runtime)
      return { models }
    } catch (error: any) {
      return {
        models: [],
        error: error.message || 'Unknown error',
      }
    }
  }

  @Post('/test')
  @Auth()
  async testProviderConnection(
    @Body() body: TestConnectionDto,
  ): Promise<{ ok: boolean }> {
    const { providerId } = body
    const { type, apiKey, endpoint, model } = await this.resolveTestConfig(body)

    if (!type) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'Provider type is required',
      })
    }

    if (!apiKey) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'API key is required',
      })
    }

    if (!model) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'Model is required',
      })
    }

    try {
      const runtime = createModelRuntime({
        id: providerId || 'test',
        name: providerId || 'test',
        type,
        apiKey,
        endpoint,
        defaultModel: model,
        enabled: true,
      })

      await runtime.generateText({
        prompt: 'Say "ok".',
        maxRetries: 0,
      })

      return OK_DATA
    } catch (error: any) {
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: error?.message || 'AI test failed',
      })
    }
  }

  @Post('/comment-review/test')
  @Auth()
  async testCommentReview(
    @Body() body: TestCommentReviewDto,
  ): Promise<{ isSpam: boolean; score?: number; reason?: string }> {
    const { text } = body

    if (!text?.trim()) {
      throw createAppException(AppErrorCode.AI_CONTENT_MISSING, {
        message: 'Comment text is required',
      })
    }

    const commentConfig = await this.configsService.get('commentOptions')
    if (!commentConfig.aiReview) {
      throw createAppException(AppErrorCode.AI_REVIEW_NOT_ENABLED)
    }

    try {
      const runtime = await this.aiService.getCommentReviewModel()

      const reviewType = commentConfig.aiReviewType || 'binary'
      const threshold = commentConfig.aiReviewThreshold || 5

      if (reviewType === 'score') {
        const promptConfig = AI_PROMPTS.comment.score(text)
        const result = await runtime.generateStructured({
          ...promptConfig,
        })

        const { score, hasSensitiveContent } = result.output
        const isSpam = score >= threshold || hasSensitiveContent === true

        let reason: string | undefined
        if (hasSensitiveContent) {
          reason = 'Contains sensitive content'
        } else if (isSpam) {
          reason = `Score ${score} exceeds threshold ${threshold}`
        }

        return { isSpam, score, reason }
      } else {
        const promptConfig = AI_PROMPTS.comment.spam(text)
        const result = await runtime.generateStructured({
          ...promptConfig,
        })

        const { isSpam: rawIsSpam, hasSensitiveContent } = result.output
        const isSpam = rawIsSpam || hasSensitiveContent === true

        let reason: string | undefined
        if (hasSensitiveContent) {
          reason = 'Contains sensitive content'
        } else if (rawIsSpam) {
          reason = 'Flagged as spam comment'
        }

        return { isSpam, reason }
      }
    } catch (error: any) {
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: error?.message || 'AI comment review test failed',
      })
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

  @Get('/models/:providerId')
  @Auth()
  async getModelsForProvider(
    @Param('providerId') providerId: string,
  ): Promise<ProviderModelsResponse> {
    const aiConfig = await this.configsService.get('ai')
    const provider = aiConfig.providers?.find((p) => p.id === providerId)

    if (!provider) {
      throw createAppException(AppErrorCode.AI_PROVIDER_NOT_FOUND, {
        providerId,
      })
    }

    if (!provider.enabled) {
      throw createAppException(AppErrorCode.AI_PROVIDER_DISABLED, {
        providerId,
      })
    }

    if (!provider.apiKey) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: `Provider ${providerId} has no API key configured`,
      })
    }

    try {
      const runtime = createModelRuntime(provider)
      const models = await this.fetchModelsFromRuntime(runtime)
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

  private async fetchModelsFromRuntime(
    runtime: IModelRuntime,
  ): Promise<ModelInfo[]> {
    if (!runtime.listModels) {
      return []
    }
    return runtime.listModels()
  }
}
