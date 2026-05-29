import type { EntityId } from '~/shared/id/entity-id'

export type PersonaKey = 'inner-self' | 'passerby' | (string & {})

export interface PersonaDefinition {
  key: PersonaKey
  displayName: string
  description: string
  needsProfile: boolean
  needsRetrieval: boolean
  usesExemplars: boolean
  staticPrompt: string
}

export interface PersonaProfile {
  id: EntityId
  personaKey: string
  profile: string
  profileSummary: string | null
  corpusVersion: number
  distillModel: string
  refreshedAt: Date
  autoNextAt: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface ExemplarPassage {
  sourceType: 'note' | 'page'
  sourceId: string
  content: string
  createdAt: Date
}

export interface PersonaDefinitionWithStatus extends PersonaDefinition {
  hasProfile: boolean
}

export interface ParsedDistillOutput {
  profile: string
  profileSummary: string | null
  metadata: {
    toneTags: string[]
    recurringThemes: string[]
    signaturePhrases: string[]
  }
}

export interface CorpusSample {
  sourceType: 'post' | 'note' | 'page'
  sourceId: string
  title: string | null
  createdAt: Date
  body: string
}
