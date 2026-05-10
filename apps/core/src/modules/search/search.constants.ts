export const SEARCH_EXACT_TITLE_BONUS = 80
export const SEARCH_PREFIX_TITLE_BONUS = 30
export const SEARCH_CANDIDATE_MULTIPLIER = 12
export const SEARCH_MAX_CANDIDATES = 300
export const SEARCH_BM25_TITLE_WEIGHT = 3
export const SEARCH_BM25_BODY_WEIGHT = 1.2
export const SEARCH_BM25_K1 = 1.2
export const SEARCH_BM25_B = 0.75
/**
 * Multiplier applied to fallback hits (i.e. matches found in the source
 * language index when the user's effective lang index didn't already cover
 * the document). Lower than 1 so primary-language matches outrank
 * cross-language fallbacks.
 */
export const SEARCH_FALLBACK_DISCOUNT = 0.6
