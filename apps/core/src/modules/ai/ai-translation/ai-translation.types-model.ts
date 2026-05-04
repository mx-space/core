import type { AiTranslationRow } from './ai-translation.types'

/**
 * Plain row shape for AI translations. Mirrors `AiTranslationRow` from the
 * repository (which is the canonical PostgreSQL row contract).
 *
 * After the MongoDB → PostgreSQL cutover this type carries no Mongoose
 * machinery (`_id`, `save()`, etc.).
 */
export type AITranslationModel = AiTranslationRow
