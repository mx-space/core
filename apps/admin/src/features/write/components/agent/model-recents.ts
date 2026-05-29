import type { ProviderModelsResponse } from '~/api/ai'
import type { SelectedAgentModel } from './types'

const STORAGE_KEY = 'agent-chat:recent-models'
const RECENT_MODELS_LIMIT = 5

function isSelectedModel(value: unknown): value is SelectedAgentModel {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as SelectedAgentModel).modelId === 'string' &&
    typeof (value as SelectedAgentModel).providerId === 'string' &&
    typeof (value as SelectedAgentModel).providerType === 'string' &&
    (value as SelectedAgentModel).providerType.length > 0,
  )
}

function isSameModel(a: SelectedAgentModel, b: SelectedAgentModel): boolean {
  return a.providerId === b.providerId && a.modelId === b.modelId
}

export function toModelValue(
  model: Pick<SelectedAgentModel, 'providerId' | 'modelId'>,
): string {
  return `${model.providerId}::${model.modelId}`
}

export function readRecentModels(): SelectedAgentModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isSelectedModel)
  } catch {
    return []
  }
}

export function writeRecentModels(models: SelectedAgentModel[]): void {
  try {
    if (models.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

export function rememberRecentModel(
  model: SelectedAgentModel,
  currentModels: SelectedAgentModel[],
): SelectedAgentModel[] {
  return [
    model,
    ...currentModels.filter((item) => !isSameModel(item, model)),
  ].slice(0, RECENT_MODELS_LIMIT)
}

export function filterRecentModelsWithin(
  models: SelectedAgentModel[],
  providerGroups: ProviderModelsResponse[],
): SelectedAgentModel[] {
  return models.filter((model) => {
    const group = providerGroups.find(
      (item) => item.providerId === model.providerId,
    )
    return Boolean(group?.models.some((item) => item.id === model.modelId))
  })
}
