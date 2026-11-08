import type { Pool, PoolClient } from 'pg'

import type { AppMigration } from './types'

/** Reusable for explicit preparation; never overwrites a recorded generation. */
export async function backfillAiMetrics(
  client: Pick<Pool | PoolClient, 'query'>,
): Promise<number> {
  let changed = 0
  for (const [table, type, model, provider, timestamp] of [
    [
      'ai_translations',
      'translation',
      "to_jsonb(r)->>'ai_model'",
      "to_jsonb(r)->>'ai_provider'",
      'coalesce(r.updated_at, r.created_at)',
    ],
    [
      'ai_insights',
      'insights',
      "to_jsonb(r)->'model_info'->>'model'",
      "to_jsonb(r)->'model_info'->>'provider'",
      'r.created_at',
    ],
  ]) {
    // All SQL identifiers/expressions above are fixed application constants.
    const result = await client.query(
      `
      INSERT INTO ai_generation_metrics (id, created_at, resource_type, resource_id, ref_id, lang, model, provider_id)
      SELECT r.id || ':v18-preparation', ${timestamp}, $1, r.id, r.ref_id, r.lang, ${model}, ${provider}
      FROM ${table} r WHERE NOT EXISTS (
        SELECT 1 FROM ai_generation_metrics m WHERE m.resource_type = $1 AND m.resource_id = r.id
      ) ON CONFLICT (id) DO NOTHING`,
      [type],
    )
    changed += result.rowCount ?? 0
  }
  return changed
}

export const migration: AppMigration = {
  id: '20261108-ai-metrics-coverage',
  description:
    'Backfill generation metadata before retiring runtime column references',
  async up({ pool, logger }) {
    const changed = await backfillAiMetrics(pool)
    logger.log(`Backfilled ${changed} AI metric rows`)
  },
}
