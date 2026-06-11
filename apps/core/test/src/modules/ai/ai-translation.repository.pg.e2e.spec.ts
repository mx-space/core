import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AiTranslationRepository,
  TranslationEntryRepository,
} from '~/modules/ai/ai-translation/ai-translation.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('ai-translation repositories upsert (real PG, ON CONFLICT)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let translationRepo: AiTranslationRepository
  let entryRepo: TranslationEntryRepository

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri() })
    const db = drizzle(pool) as unknown as AppDatabase
    const snowflake = new SnowflakeService()
    translationRepo = new AiTranslationRepository(db, snowflake)
    entryRepo = new TranslationEntryRepository(db, snowflake)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('inserts then updates an ai_translations row on the same (refId, refType, lang)', async () => {
    const refId = '424242424242424242'
    const base = {
      hash: 'hash-v1',
      refId,
      refType: 'posts',
      lang: 'ja',
      sourceLang: 'zh',
      title: 'v1 title',
      text: 'v1 text',
      subtitle: null,
      summary: null,
      tags: ['a'],
      sourceModifiedAt: null,
      aiModel: 'm',
      aiProvider: 'p',
      contentFormat: null,
      content: null,
      sourceBlockSnapshots: undefined,
      sourceMetaHashes: undefined,
    }

    const created = await translationRepo.upsert(base as any)
    expect(created.title).toBe('v1 title')

    const updated = await translationRepo.upsert({
      ...base,
      hash: 'hash-v2',
      title: 'v2 title',
      tags: ['b'],
    } as any)
    expect(updated.id).toBe(created.id)
    expect(updated.title).toBe('v2 title')
    expect(updated.hash).toBe('hash-v2')
    expect(updated.tags).toEqual(['b'])

    const all = await translationRepo.listByRefId(refId)
    expect(all).toHaveLength(1)
  })

  it('inserts then updates a translation_entries row, preserving sourceUpdatedAt when omitted', async () => {
    const key = {
      keyPath: 'category.name',
      lang: 'ja',
      keyType: 'entity',
      lookupKey: 'lookup-1',
    }
    const stamped = new Date('2026-01-01T00:00:00Z')

    const created = await entryRepo.upsert({
      ...key,
      sourceText: 'src v1',
      translatedText: 'trans v1',
      sourceUpdatedAt: stamped,
    })
    expect(created.sourceUpdatedAt?.toISOString()).toBe(stamped.toISOString())

    const updated = await entryRepo.upsert({
      ...key,
      sourceText: 'src v2',
      translatedText: 'trans v2',
    })
    expect(updated.id).toBe(created.id)
    expect(updated.translatedText).toBe('trans v2')
    expect(updated.sourceUpdatedAt?.toISOString()).toBe(stamped.toISOString())
  })
})
