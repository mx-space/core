import { Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'

import type { AIConfig } from '../configs/configs.schema'
import { ConfigsService } from '../configs/configs.service'
import type { AIModelAssignment, AIProviderConfig } from './ai.types'
import { AIFeatureKey, AIProviderType } from './ai.types'
import type { IModelRuntime } from './runtime'
import { createModelRuntime } from './runtime'

export interface AIResolvedModelInfo {
  provider: AIProviderType
  model: string
}

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigsService) {}

  public async getSummaryModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.Summary)
  }

  public async getWriterModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.Writer)
  }

  public async getCommentReviewModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.CommentReview)
  }

  public async getTranslationModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.Translation)
  }

  public async getTranslationModelWithInfo(): Promise<{
    runtime: IModelRuntime
    info: AIResolvedModelInfo
  }> {
    return this.getModelWithInfoForFeature(AIFeatureKey.Translation)
  }

  public async getInsightsModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.Insights)
  }

  public async getInsightsTranslationModel(): Promise<IModelRuntime> {
    // Fall back to the general translation model if no insights-specific assignment is set.
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(
      aiConfig,
      AIFeatureKey.InsightsTranslation,
    )
    if (!assignment) {
      return this.getTranslationModel()
    }
    return this.getModelForFeature(AIFeatureKey.InsightsTranslation)
  }

  private async resolveFeatureRuntime(feature: AIFeatureKey): Promise<{
    runtime: IModelRuntime
    provider: AIProviderConfig
    assignment: AIModelAssignment | undefined
  }> {
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(aiConfig, feature)
    const provider = this.resolveProvider(aiConfig, assignment?.providerId)

    if (!provider) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'No AI provider configured',
      )
    }

    return {
      runtime: createModelRuntime(provider, assignment?.model),
      provider,
      assignment,
    }
  }

  private async getModelForFeature(
    feature: AIFeatureKey,
  ): Promise<IModelRuntime> {
    const { runtime } = await this.resolveFeatureRuntime(feature)
    return runtime
  }

  private async getModelWithInfoForFeature(feature: AIFeatureKey): Promise<{
    runtime: IModelRuntime
    info: AIResolvedModelInfo
  }> {
    const { runtime, provider, assignment } =
      await this.resolveFeatureRuntime(feature)
    return {
      runtime,
      info: {
        provider: provider.type,
        model: assignment?.model || provider.defaultModel,
      },
    }
  }

  private getAssignment(
    config: AIConfig,
    feature: AIFeatureKey,
  ): AIModelAssignment | undefined {
    const featureToConfigKey: Record<AIFeatureKey, keyof AIConfig> = {
      [AIFeatureKey.Summary]: 'summaryModel',
      [AIFeatureKey.Writer]: 'writerModel',
      [AIFeatureKey.CommentReview]: 'commentReviewModel',
      [AIFeatureKey.Translation]: 'translationModel',
      [AIFeatureKey.Insights]: 'insightsModel',
      [AIFeatureKey.InsightsTranslation]: 'insightsTranslationModel',
    }
    return config[featureToConfigKey[feature]] as AIModelAssignment | undefined
  }

  private resolveProvider(
    config: AIConfig,
    providerId?: string,
  ): AIProviderConfig | null {
    if (!config.providers?.length) {
      return null
    }

    // Use specified provider if found and enabled
    if (providerId) {
      const found = config.providers.find(
        (p) => p.id === providerId && p.enabled,
      )
      if (found) return found
    }

    // Fallback to first enabled provider
    return config.providers.find((p) => p.enabled) || null
  }
}
