import type { AppMigration } from './types'

export const migration: AppMigration = {
  id: '20260524-ai-corpus-initial-backfill',
  description:
    'Mark initial corpus_embeddings backfill window; actual backfill runs via POST /ai-embeddings/backfill once the embedding model is configured.',
  async up({ logger }) {
    logger.log(
      'Initial AI corpus backfill marker recorded. Run POST /ai-embeddings/backfill after configuring an embedding model to populate corpus_embeddings.',
    )
  },
}
