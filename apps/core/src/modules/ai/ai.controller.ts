import { Body, Get, Param, Post } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
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
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'Provider type is required',
      )
    }

    if (!apiKey) {
      throw new BizException(ErrorCodeEnum.AINotEnabled, 'API key is required')
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

      return { ok: true }
    } catch (error: any) {
      throw new BizException(
        ErrorCodeEnum.AIException,
        error?.message || 'AI test failed',
      )
    }
  }

  @Post('/comment-review/test')
  @Auth()
  async testCommentReview(
    @Body() body: TestCommentReviewDto,
  ): Promise<{ isSpam: boolean; score?: number; reason?: string }> {
    const { text } = body

    if (!text?.trim()) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFoundCantProcess,
        'Comment text is required',
      )
    }

    const commentConfig = await this.configsService.get('commentOptions')
    if (!commentConfig.aiReview) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'AI review is not enabled',
      )
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

        const isSpam =
          result.output.score >= threshold ||
          result.output.hasSensitiveContent === true

        return {
          isSpam,
          score: result.output.score,
          reason: result.output.hasSensitiveContent
            ? '包含敏感内容'
            : isSpam
              ? `评分 ${result.output.score} 超过阈值 ${threshold}`
              : undefined,
        }
      } else {
        const promptConfig = AI_PROMPTS.comment.spam(text)
        const result = await runtime.generateStructured({
          ...promptConfig,
        })

        const isSpam =
          result.output.isSpam || result.output.hasSensitiveContent === true

        return {
          isSpam,
          reason: result.output.hasSensitiveContent
            ? '包含敏感内容'
            : result.output.isSpam
              ? '判定为垃圾评论'
              : undefined,
        }
      }
    } catch (error: any) {
      throw new BizException(
        ErrorCodeEnum.AIException,
        error?.message || 'AI comment review test failed',
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
