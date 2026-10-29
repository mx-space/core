export {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
} from '@mx-space/ai/prompts'

/** Redis lock TTL for AI streaming tasks (in seconds) */
export const AI_STREAM_LOCK_TTL = 60
/** Redis TTL for AI streaming results (in seconds) */
export const AI_STREAM_RESULT_TTL = 10 * 60
/** Max Redis Stream length for AI streaming */
export const AI_STREAM_MAXLEN = 2000
/** Redis Stream block time (ms) */
// 200ms balances smooth SSE animation and Redis load in dev
export const AI_STREAM_READ_BLOCK_MS = 200
/** Idle timeout for AI streaming follower (ms) */
export const AI_STREAM_IDLE_TIMEOUT_MS = 120_000

/** Maximum target languages accepted in a single AI generation task */
export const MAX_LANGS_PER_TASK = 8

/** Maximum character length for fallback slug generation */
export const AI_FALLBACK_SLUG_MAX_LENGTH = 50
