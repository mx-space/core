import { Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import type { AIDto } from '../configs/configs.dto'
import { ConfigsService } from '../configs/configs.service'
import { createLanguageModel } from './ai-provider.factory'
import type { AIModelAssignment, AIProviderConfig } from './ai.types'
import { AIFeatureKey } from './ai.types'

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigsService) {}

  public async getSummaryModel() {
    return this.getModelForFeature(AIFeatureKey.Summary)
  }

  public async getWriterModel() {
    return this.getModelForFeature(AIFeatureKey.Writer)
  }

  public async getCommentReviewModel() {
    return this.getModelForFeature(AIFeatureKey.CommentReview)
  }

  private async getModelForFeature(feature: AIFeatureKey) {
    const aiConfig = await this.configService.get('ai')

    const assignment = this.getAssignment(aiConfig, feature)
    const provider = this.resolveProvider(aiConfig, assignment?.providerId)

    if (!provider) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        'No AI provider configured',
      )
    }

    return createLanguageModel(provider, assignment?.model)
  }

  private getAssignment(
    config: AIDto,
    feature: AIFeatureKey,
  ): AIModelAssignment | undefined {
    const featureToConfigKey: Record<AIFeatureKey, keyof AIDto> = {
      [AIFeatureKey.Summary]: 'summaryModel',
      [AIFeatureKey.Writer]: 'writerModel',
      [AIFeatureKey.CommentReview]: 'commentReviewModel',
    }
    return config[featureToConfigKey[feature]] as AIModelAssignment | undefined
  }

  private resolveProvider(
    config: AIDto,
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
