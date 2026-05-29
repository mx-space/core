import type { BusinessEvents } from '~/constants/business-event.constant'

import type { RetrievalResult } from '../ai-embeddings/ai-embeddings.types'
import type { AiMemory } from '../ai-memory/ai-memory.types'
import type {
  ExemplarPassage,
  PersonaDefinition,
  PersonaKey,
  PersonaProfile,
} from '../ai-persona/ai-persona.types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface EchoPromptInput<Subject = unknown> {
  subject: Subject
  persona: PersonaDefinition
  profile: PersonaProfile | null
  retrieval: RetrievalResult[]
  memories: AiMemory[]
  exemplars: ExemplarPassage[]
}

export interface EchoScenario<Subject = unknown> {
  readonly key: string
  readonly triggerEvent?: BusinessEvents
  readonly defaultPersonas: PersonaKey[]
  readonly persistEchoes?: boolean
  readonly emitOnReady?: BusinessEvents

  loadSubject: (subjectId: string) => Promise<Subject | null>
  extractRetrievalQuery: (subject: Subject) => string | null
  buildPrompt: (input: EchoPromptInput<Subject>) => ChatMessage[]
  postProcess?: (content: string, subject: Subject) => string
}
