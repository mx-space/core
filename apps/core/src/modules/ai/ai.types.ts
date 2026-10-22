export type {
  AIModelAssignment,
  AIProviderCapabilities,
  AIProviderCapability,
  AIProviderConfig,
  AIReasoningEffort,
} from '@mx-space/ai/runtime'
export { AIProviderType } from '@mx-space/ai/runtime'

export enum AIFeatureKey {
  Summary = 'summary',
  Writer = 'writer',
  CommentReview = 'commentReview',
  Translation = 'translation',
  TranslationReview = 'translationReview',
  FieldTranslation = 'fieldTranslation',
  Insights = 'insights',
  InsightsTranslation = 'insightsTranslation',
}
