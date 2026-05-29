import { AppErrorCode, createAppException } from '~/common/errors'

import type { PersonaDefinition, PersonaKey } from './ai-persona.types'
import { AI_PERSONA_PROMPTS } from './prompts'

export const PERSONA_REGISTRY: Record<string, PersonaDefinition> = {
  'inner-self': {
    key: 'inner-self',
    displayName: 'Inner Self',
    description:
      "The author's alternate voice — distilled from their own writing.",
    needsProfile: true,
    needsRetrieval: true,
    usesExemplars: true,
    staticPrompt: AI_PERSONA_PROMPTS.innerSelf,
  },
  passerby: {
    key: 'passerby',
    displayName: 'Passerby',
    description: 'A visiting stranger; brief, fresh-eyed reactions.',
    needsProfile: false,
    needsRetrieval: false,
    usesExemplars: false,
    staticPrompt: AI_PERSONA_PROMPTS.passerby,
  },
}

export function listPersonas(): PersonaDefinition[] {
  return Object.values(PERSONA_REGISTRY)
}

export function getPersonaDefinition(key: string): PersonaDefinition {
  const definition = PERSONA_REGISTRY[key]
  if (!definition) {
    throw createAppException(AppErrorCode.AI_PERSONA_NOT_FOUND, { key })
  }
  return definition
}

export function tryGetPersonaDefinition(
  key: string,
): PersonaDefinition | undefined {
  return PERSONA_REGISTRY[key]
}

export function isKnownPersonaKey(key: string): key is PersonaKey {
  return key in PERSONA_REGISTRY
}
