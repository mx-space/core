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

  private async getModelForFeature(
    feature: AIFeatureKey,
  ): Promise<IModelRuntime> {
    const aiConfig = await this.configService.get('ai')

    const assignment = this.getAssignment(aiConfig, feature)
    const provider = this.resolveProvider(aiConfig, assignment?.providerId)

    if (!provider) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'No AI provider configured',
      )
    }

    return createModelRuntime(provider, assignment?.model)
  }

  private async getModelWithInfoForFeature(feature: AIFeatureKey): Promise<{
    runtime: IModelRuntime
    info: AIResolvedModelInfo
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

    const modelName = assignment?.model || provider.defaultModel
    return {
      runtime: createModelRuntime(provider, assignment?.model),
      info: {
        provider: provider.type,
        model: modelName,
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
