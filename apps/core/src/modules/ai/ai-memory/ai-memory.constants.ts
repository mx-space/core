export const AI_MEMORY_SCOPE_REGEX =
  /^(global|persona:[\da-z-]+|scenario:[\da-z-]+)$/

export const AI_MEMORY_TYPES = [
  'fact',
  'event',
  'preference',
  'thread',
  'pattern',
] as const

export const AI_MEMORY_STATUSES = [
  'active',
  'superseded',
  'archived',
  'pending_review',
] as const

export const AI_MEMORY_DEFAULT_RECALL_TOP_K = 5
export const AI_MEMORY_DEFAULT_RECALL_MIN_SIMILARITY = 0.7
