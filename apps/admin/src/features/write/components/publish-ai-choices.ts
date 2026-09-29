import type {
  PublishAiResource,
  PublishAiResourceRequest,
} from '~/api/publish-jobs'
import type { TranslationKey } from '~/i18n/types'

export type PublishAiChoice = 'none' | 'sync' | 'async'
export type PublishAiChoices = Record<PublishAiResource, PublishAiChoice>

export const publishAiResourceOrder: PublishAiResource[] = [
  'summary',
  'insights',
  'translation',
  'tts',
]

export const publishAiResourceLabels: Record<
  PublishAiResource,
  TranslationKey
> = {
  insights: 'ai.overview.capability.insights',
  summary: 'ai.overview.capability.summary',
  translation: 'ai.overview.capability.translation',
  tts: 'ai.overview.capability.tts',
}

const STORAGE_KEY = 'mx-admin:publish-ai-choices'
const CHOICES = new Set<PublishAiChoice>(['none', 'sync', 'async'])

export const emptyPublishAiChoices = (): PublishAiChoices => ({
  insights: 'none',
  summary: 'none',
  translation: 'none',
  tts: 'none',
})

export function parsePublishAiChoices(raw: string | null): PublishAiChoices {
  const choices = emptyPublishAiChoices()
  if (!raw) return choices
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>
    for (const resource of publishAiResourceOrder) {
      const value = stored?.[resource]
      if (CHOICES.has(value as PublishAiChoice)) {
        choices[resource] = value as PublishAiChoice
      }
    }
  } catch {
    return choices
  }
  return choices
}

export function loadPublishAiChoices(): PublishAiChoices {
  try {
    return parsePublishAiChoices(localStorage.getItem(STORAGE_KEY))
  } catch {
    return emptyPublishAiChoices()
  }
}

export function savePublishAiChoices(choices: PublishAiChoices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    /* storage can be unavailable (private mode); the next dialog starts empty */
  }
}

export function toPublishAiRequests(
  choices: PublishAiChoices,
  isAvailable: (resource: PublishAiResource) => boolean,
): PublishAiResourceRequest[] {
  return publishAiResourceOrder.flatMap((resource) => {
    const choice = choices[resource]
    if (choice === 'none' || !isAvailable(resource)) return []
    return [{ mode: choice, resource }]
  })
}

export function normalizeTaskAiResources(
  resources: ReadonlyArray<PublishAiResource | PublishAiResourceRequest>,
): PublishAiResourceRequest[] {
  return resources.map((item) =>
    typeof item === 'string' ? { mode: 'sync', resource: item } : item,
  )
}
