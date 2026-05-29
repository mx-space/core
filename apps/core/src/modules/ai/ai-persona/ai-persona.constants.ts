export const PERSONA_DISTILL_LOCK_KEY_PREFIX = 'persona:distill:'
export const PERSONA_DISTILL_LOCK_TTL_SEC = 600

export const PERSONA_EXEMPLAR_CANDIDATES_CACHE_KEY_PREFIX =
  'persona:exemplars:candidates:'
export const PERSONA_EXEMPLAR_CANDIDATES_CACHE_TTL_SEC = 3600

export const PERSONA_DEFAULTS = {
  distillSampleMaxTokens: 60_000,
  exemplarsLengthMin: 200,
  exemplarsLengthMax: 800,
  exemplarsCandidateCacheTtlSec: 3600,
  exemplarsCandidatesMax: 200,
  charsPerToken: 4,
  perTypeQuota: { post: 0.5, note: 0.3, page: 0.2 },
  recencyHalfLifeDays: 365,
}
