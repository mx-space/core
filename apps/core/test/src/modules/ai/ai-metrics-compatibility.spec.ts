import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AiInsightsRepository } from '~/modules/ai/ai-insights/ai-insights.repository'
import { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('prepared AI repositories without retired columns', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  let translation: AiTranslationRepository
  let insights: AiInsightsRepository
  const refId = '424242424242424242'
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_metrics_contract')
    await context.pool.query(
      'ALTER TABLE ai_translations DROP COLUMN ai_model, DROP COLUMN ai_provider; ALTER TABLE ai_insights DROP COLUMN model_info',
    )
    translation = new AiTranslationRepository(
      context.db,
      new SnowflakeService(),
    )
    insights = new AiInsightsRepository(context.db, new SnowflakeService())
  })
  afterAll(async () => context?.close())

  it('inserts, updates and reads translations without implicit old-column references', async () => {
    const value = {
      refId,
      refType: 'post',
      hash: 'h',
      lang: 'ja',
      sourceLang: 'zh',
      title: 'T',
      text: 'Body',
      aiModel: 'old-signature',
      aiProvider: 'provider',
    }
    const created = await translation.upsert(value as any)
    await translation.upsert({ ...value, title: 'Changed' } as any)
    await translation.updateById(created.id, {
      text: 'Updated',
      aiModel: 'ignored-old-field',
    })
    await context.pool.query(
      "INSERT INTO ai_generation_metrics (id, resource_type, resource_id, ref_id, model, provider_id) VALUES ('fixture', 'translation', $1, $2, 'new-model', 'new-provider')",
      [created.id, refId],
    )
    expect(await translation.findById(created.id)).toMatchObject({
      text: 'Updated',
      aiModel: 'new-model',
      aiProvider: 'new-provider',
    })
    expect(
      await translation.updateById(created.id, { title: 'Edited' }),
    ).toMatchObject({ aiModel: 'new-model', aiProvider: 'new-provider' })
    expect(
      await translation.upsert({ ...value, title: 'Edited again' } as any),
    ).toMatchObject({ aiModel: 'new-model', aiProvider: 'new-provider' })
    expect(await translation.findByRef(refId, 'post', 'ja')).toBeTruthy()
    expect(await translation.findByRefAndLang(refId, 'ja')).toBeTruthy()
    expect(await translation.listByRefId(refId)).toHaveLength(1)
    expect(await translation.listByRefIds([refId])).toHaveLength(1)
    expect(await translation.listByRefIdsAndLang([refId], 'ja')).toHaveLength(1)
    expect((await translation.list()).data).toHaveLength(1)
  })

  it('inserts, updates and reads insights while deriving the legacy API view', async () => {
    const value = {
      refId,
      hash: 'h',
      lang: 'ja',
      content: 'Body',
      modelInfo: { model: 'old-signature' },
    }
    const created = await insights.upsert(value)
    await insights.upsert({ ...value, content: 'Changed' })
    await insights.updateContent(created.id, 'Updated')
    await context.pool.query(
      "INSERT INTO ai_generation_metrics (id, resource_type, resource_id, ref_id, model, provider_id) VALUES ('insight-metric', 'insights', $1, $2, 'new-model', 'new-provider')",
      [created.id, refId],
    )
    expect(await insights.findById(created.id)).toMatchObject({
      content: 'Updated',
      modelInfo: { model: 'new-model', provider: 'new-provider' },
    })
    expect(await insights.updateContent(created.id, 'Edited')).toMatchObject({
      modelInfo: { model: 'new-model', provider: 'new-provider' },
    })
    expect(
      await insights.upsert({ ...value, content: 'Edited again' }),
    ).toMatchObject({
      modelInfo: { model: 'new-model', provider: 'new-provider' },
    })
    expect(await insights.findByRefAndLang(refId, 'ja')).toBeTruthy()
    expect(await insights.findSourceForRef(refId, 'ja')).toBeTruthy()
    expect(await insights.listForRef(refId)).toHaveLength(1)
    expect(await insights.listByRefIds([refId])).toHaveLength(1)
    expect((await insights.list()).data).toHaveLength(1)
  })
})
