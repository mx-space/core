import type {
  AIConfig,
  AIModelAssignment,
} from '~/features/settings/types/settings'

export const onboardingSteps = [
  'welcome',
  'account',
  'site',
  'ai-providers',
  'ai-models',
  'ai-features',
  'ready',
] as const

export type OnboardingStep = (typeof onboardingSteps)[number]

export interface OnboardingProgress {
  status: 'active' | 'dismissed' | 'finished'
  step: OnboardingStep
}

export function deriveServiceUrls(input: {
  adminHref: string
  apiUrl: string
  gatewayUrl: string
}) {
  const admin = new URL(input.adminHref)
  const adminPath = admin.pathname.replace(/\/+$/, '')
  return {
    adminUrl: `${admin.origin}${adminPath}`,
    serverUrl: input.apiUrl.replace(/\/+$/, ''),
    wsUrl: (input.gatewayUrl || new URL(input.apiUrl).origin).replace(
      /\/+$/,
      '',
    ),
  }
}

const progressKey = (ownerId: string) => `mx-admin:onboarding:${ownerId}`

export function readOnboardingProgress(
  ownerId: string,
): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(ownerId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<OnboardingProgress>
    if (
      !onboardingSteps.includes(value.step as OnboardingStep) ||
      !['active', 'dismissed', 'finished'].includes(value.status as string)
    ) {
      return null
    }
    return value as OnboardingProgress
  } catch {
    return null
  }
}

export function writeOnboardingProgress(
  ownerId: string,
  progress: OnboardingProgress,
) {
  try {
    localStorage.setItem(progressKey(ownerId), JSON.stringify(progress))
  } catch {}
}

export const textModelFeatures = [
  'writerModel',
  'summaryModel',
  'translationModel',
  'translationReviewModel',
  'insightsModel',
] as const

export type ModelFeature =
  (typeof textModelFeatures)[number] | 'imageModel' | 'ttsModel'

export interface ModelPlan {
  defaultModel: AIModelAssignment | null
  overrides: Partial<Record<ModelFeature, AIModelAssignment | null>>
}

export function applyModelPlan(config: AIConfig, plan: ModelPlan): AIConfig {
  const next: AIConfig = { ...config }
  for (const feature of textModelFeatures) {
    const assignment = plan.overrides[feature] ?? plan.defaultModel
    if (assignment) next[feature] = assignment
  }
  if (plan.overrides.ttsModel) {
    next.tts = { ...config.tts, model: plan.overrides.ttsModel }
  }
  if (plan.overrides.imageModel) {
    next.imageGeneration = {
      ...config.imageGeneration,
      model: plan.overrides.imageModel,
    }
  }
  return next
}
