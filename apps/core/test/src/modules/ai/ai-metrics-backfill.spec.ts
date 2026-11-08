import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { backfillAiMetrics } from '~/database/app-migrations/20261108-ai-metrics-coverage'

describe('AI metrics preparation backfill', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_metrics_backfill')
  })
  afterAll(async () => context?.close())
  it('fills gaps once and preserves newer generation metrics', async () => {
    await context.pool.query(
      "INSERT INTO ai_translations (id, ref_id, ref_type, hash, lang, source_lang, title, text, ai_model, ai_provider) VALUES ('100', '200', 'post', 'h', 'ja', 'zh', 'T', 'Body', 'legacy-model', 'legacy-provider'), ('101', '200', 'post', 'h', 'en', 'zh', 'T', 'Body', 'stale-model', 'stale-provider')",
    )
    await context.pool.query(
      "INSERT INTO ai_generation_metrics (id, resource_type, resource_id, ref_id, model) VALUES ('current', 'translation', '101', '200', 'current-model')",
    )
    expect(await backfillAiMetrics(context.pool)).toBe(1)
    expect(await backfillAiMetrics(context.pool)).toBe(0)
    const rows = (
      await context.pool.query(
        'SELECT resource_id, model, provider_id FROM ai_generation_metrics ORDER BY resource_id',
      )
    ).rows
    expect(rows).toEqual([
      {
        resource_id: '100',
        model: 'legacy-model',
        provider_id: 'legacy-provider',
      },
      { resource_id: '101', model: 'current-model', provider_id: null },
    ])
  })
})
