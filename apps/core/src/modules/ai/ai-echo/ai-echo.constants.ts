export const ECHO_SCENARIO = Symbol('ECHO_SCENARIO')

export const ECHO_DEFAULTS = {
  dailyQuota: 200,
  retrievalTopK: 5,
  retrievalMinSimilarity: 0.72,
  exemplarsCount: 4,
  upstreamMessageMaxLen: 1000,
} as const

export const ECHO_QUOTA_REDIS_KEY_PREFIX = 'ai-echo:quota:'
