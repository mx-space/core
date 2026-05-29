import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

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

  public async getTranslationReviewModel(): Promise<IModelRuntime> {
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(
      aiConfig,
      AIFeatureKey.TranslationReview,
    )
    if (!assignment) {
      return this.getTranslationModel()
    }
    return this.getModelForFeature(AIFeatureKey.TranslationReview)
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

  public async getEchoModel(): Promise<IModelRuntime> {
    return this.getModelForFeature(AIFeatureKey.Echo)
  }

  public async getEmbeddingModel(): Promise<IModelRuntime> {
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(aiConfig, AIFeatureKey.Embedding)
    const provider = this.resolveAssignedProvider(aiConfig, assignment)
    if (!provider) {
      throw createAppException(AppErrorCode.AI_EMBEDDING_MODEL_NOT_CONFIGURED)
    }
    return createModelRuntime(provider, assignment?.model)
  }

  public async getPersonaDistillModel(): Promise<IModelRuntime> {
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(aiConfig, AIFeatureKey.PersonaDistill)
    if (!assignment) {
      return this.getEchoModel()
    }
    return this.getModelForFeature(AIFeatureKey.PersonaDistill)
  }

  public async hasFeatureModel(feature: AIFeatureKey): Promise<boolean> {
    const aiConfig = await this.configService.get('ai')
    const assignment = this.getAssignment(aiConfig, feature)
    if (feature === AIFeatureKey.Embedding) {
      return Boolean(this.resolveAssignedProvider(aiConfig, assignment))
    }
    return Boolean(this.resolveProvider(aiConfig, assignment?.providerId))
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
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: 'No AI provider configured',
      })
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
      [AIFeatureKey.TranslationReview]: 'translationReviewModel',
      [AIFeatureKey.Insights]: 'insightsModel',
      [AIFeatureKey.InsightsTranslation]: 'insightsTranslationModel',
      [AIFeatureKey.Echo]: 'echoModel',
      [AIFeatureKey.Embedding]: 'embeddingModel',
      [AIFeatureKey.PersonaDistill]: 'personaDistillModel',
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

  private resolveAssignedProvider(
    config: AIConfig,
    assignment?: AIModelAssignment,
  ): AIProviderConfig | null {
    if (!assignment?.providerId || !config.providers?.length) {
      return null
    }
    return (
      config.providers.find(
        (provider) => provider.id === assignment.providerId && provider.enabled,
      ) || null
    )
  }
}
