import type { ProviderModelsResponse } from '~/api/ai'
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

export function resolveResumeStep(
  progress: OnboardingProgress | null,
): OnboardingStep | null {
  if (!progress || progress.status === 'finished') return null
  if (progress.step === 'welcome' || progress.step === 'account') return 'site'
  return progress.step
}

const usernamePattern = /^[\w.-]{3,30}$/

export function isValidOnboardingUsername(username: string) {
  return usernamePattern.test(username)
}

function storeValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
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
  storeValue(progressKey(ownerId), JSON.stringify(progress))
}

const pendingKey = 'mx-admin:onboarding:pending'

export function markOnboardingPending() {
  storeValue(pendingKey, '1')
}

export function claimPendingOnboarding(
  ownerId: string,
): OnboardingProgress | null {
  try {
    if (!localStorage.getItem(pendingKey)) return null
    localStorage.removeItem(pendingKey)
  } catch {
    return null
  }
  const progress: OnboardingProgress = { status: 'active', step: 'site' }
  writeOnboardingProgress(ownerId, progress)
  return progress
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
  if ('ttsModel' in plan.overrides) {
    next.tts = { ...config.tts, model: plan.overrides.ttsModel ?? null }
  }
  if ('imageModel' in plan.overrides) {
    next.imageGeneration = {
      ...config.imageGeneration,
      model: plan.overrides.imageModel ?? null,
    }
  }
  return next
}

const assignmentFields = [
  'commentReviewModel',
  'decisionModel',
  'fieldTranslationModel',
  'insightsModel',
  'insightsTranslationModel',
  'summaryModel',
  'translationModel',
  'translationReviewModel',
  'writerModel',
] as const

export function removeProviderFromConfig(
  config: AIConfig,
  providerId: string,
): AIConfig {
  const pointsAtProvider = (assignment?: AIModelAssignment | null) =>
    assignment?.providerId === providerId
  const next: AIConfig = {
    ...config,
    providers: (config.providers ?? []).filter(
      (provider) => provider.id !== providerId,
    ),
  }
  for (const field of assignmentFields) {
    if (pointsAtProvider(config[field])) next[field] = null
  }
  if (config.tts && pointsAtProvider(config.tts.model)) {
    next.tts = { ...config.tts, model: null }
  }
  if (
    config.imageGeneration &&
    pointsAtProvider(config.imageGeneration.model)
  ) {
    next.imageGeneration = { ...config.imageGeneration, model: null }
  }
  return next
}

function sameLanguages(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((language) => right.includes(language))
  )
}

export function nextSummaryLanguages(config: AIConfig, languages: string[]) {
  const summary = config.summaryTargetLanguages ?? []
  const following =
    summary.length === 0 ||
    sameLanguages(summary, config.translationTargetLanguages ?? [])
  return following ? languages : summary
}

export interface ModelOption {
  label: string
  value: string
}

const modelOptionSeparator = '::'

export function buildModelOptions(
  groups: Pick<
    ProviderModelsResponse,
    'models' | 'providerId' | 'providerName'
  >[],
): ModelOption[] {
  return groups.flatMap((group) =>
    group.models.map((model) => ({
      label: `${group.providerName} · ${model.name || model.id}`,
      value: `${group.providerId}${modelOptionSeparator}${model.id}`,
    })),
  )
}

export function parseModelOption(value: string): AIModelAssignment | null {
  const index = value.indexOf(modelOptionSeparator)
  if (index <= 0) return null
  return {
    model: value.slice(index + modelOptionSeparator.length),
    providerId: value.slice(0, index),
  }
}

export function toModelOption(assignment?: AIModelAssignment | null) {
  if (!assignment?.providerId || !assignment.model) return ''
  return `${assignment.providerId}${modelOptionSeparator}${assignment.model}`
}

export const onboardingLanguages = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
] as const
