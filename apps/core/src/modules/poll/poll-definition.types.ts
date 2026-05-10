export type PollMode = 'single' | 'multiple'

export type PollShowResults = 'always' | 'after-vote' | 'after-close'

export interface PollOptionDefinition {
  id: string
  label: string
}

export interface PollDefinition {
  pollId: string
  question: string
  options: PollOptionDefinition[]
  mode: PollMode
  closeAt?: string
  showResults?: PollShowResults
}

export interface PollContentCandidate {
  content: string | null
  text: string | null
  contentFormat: string
}
