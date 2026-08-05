import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import type { AiTtsRow } from '~/modules/ai/ai-tts/ai-tts.types'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('ai-tts repository (real PG, ON CONFLICT + cascade)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let db: AppDatabase
  let repository: AiTtsRepository

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri() })
    db = drizzle(pool) as unknown as AppDatabase
    const snowflake = new SnowflakeService()
    repository = new AiTtsRepository(db, snowflake)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  let parent: AiTtsRow

  it('upserts a parent row and replaces a block in place', async () => {
    parent = await repository.upsertParent({
      refId: '1',
      lang: 'zh',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: ['a'],
      charCount: 5,
      sourceModifiedAt: new Date(),
    })
    expect(parent.refId).toBe('1')
    expect(parent.lang).toBe('zh')

    await repository.upsertBlock({
      ttsId: parent.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp1',
      text: 'hello',
      url: 'https://cdn/x1.mp3',
      storageBackend: 's3',
      storageKey: 'k/x1',
      byteSize: 10,
    })
    await repository.upsertBlock({
      ttsId: parent.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp2',
      text: 'hello there',
      url: 'https://cdn/x2.mp3',
      storageBackend: 's3',
      storageKey: 'k/x2',
      byteSize: 12,
    })

    const blocks = await repository.findBlocks(parent.id)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].fingerprint).toBe('fp2')
    expect(blocks[0].storageKey).toBe('k/x2')
  })

  it('upserting a parent row again for the same (refId, lang) replaces it in place', async () => {
    const updated = await repository.upsertParent({
      refId: '1',
      lang: 'zh',
      isTranslation: false,
      sourceLang: null,
      model: 'm2',
      voice: 'v2',
      speed: 1.2,
      format: 'mp3',
      blockOrder: ['a', 'b'],
      charCount: 11,
      sourceModifiedAt: new Date(),
    })
    expect(updated.id).toBe(parent.id)
    expect(updated.model).toBe('m2')
    expect(updated.blockOrder).toEqual(['a', 'b'])

    const all = await repository.findAllByRef('1')
    expect(all).toHaveLength(1)
  })

  it('findMeta reports the block count from block_order', async () => {
    const meta = await repository.findMeta('1', 'zh')
    expect(meta?.id).toBe(parent.id)
    expect(meta?.blockCount).toBe(2)
  })

  it('findMeta returns null when no row matches', async () => {
    expect(await repository.findMeta('999999', 'zh')).toBeNull()
  })

  it('cascades block deletion when the parent is deleted', async () => {
    const removed = await repository.deleteById(parent.id)
    expect(removed.map((b) => b.storageKey)).toContain('k/x2')
    expect(await repository.findBlocks(parent.id)).toEqual([])
    expect(await repository.findByRefAndLang('1', 'zh')).toBeNull()
  })

  it('findByRefAndLang returns null when nothing exists for that language', async () => {
    await repository.upsertParent({
      refId: '2',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })

    expect(await repository.findByRefAndLang('2', 'ja')).toBeNull()
    const found = await repository.findByRefAndLang('2', 'en')
    expect(found?.refId).toBe('2')
  })

  it('findAllByRef returns every language row for an article', async () => {
    await repository.upsertParent({
      refId: '3',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })
    await repository.upsertParent({
      refId: '3',
      lang: 'ja',
      isTranslation: true,
      sourceLang: 'en',
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })

    const rows = await repository.findAllByRef('3')
    expect(rows.map((r) => r.lang).sort()).toEqual(['en', 'ja'])
  })

  it('deleteBlocksByIds removes only the targeted block rows', async () => {
    const parent4 = await repository.upsertParent({
      refId: '4',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: ['a', 'b'],
      charCount: 2,
      sourceModifiedAt: null,
    })
    const blockA = await repository.upsertBlock({
      ttsId: parent4.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fpa',
      text: 'a',
      url: 'https://cdn/a.mp3',
      storageBackend: 's3',
      storageKey: 'k/a',
    })
    await repository.upsertBlock({
      ttsId: parent4.id,
      blockId: 'b',
      chunkIndex: 0,
      fingerprint: 'fpb',
      text: 'b',
      url: 'https://cdn/b.mp3',
      storageBackend: 's3',
      storageKey: 'k/b',
    })

    await repository.deleteBlocksByIds([blockA.id])

    const remaining = await repository.findBlocks(parent4.id)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].blockId).toBe('b')
  })

  it('deleteByRefId removes every language row for an article and returns their blocks', async () => {
    const en = await repository.upsertParent({
      refId: '5',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: ['a'],
      charCount: 1,
      sourceModifiedAt: null,
    })
    const ja = await repository.upsertParent({
      refId: '5',
      lang: 'ja',
      isTranslation: true,
      sourceLang: 'en',
      model: 'm',
      voice: 'v',
      speed: 1,
      format: 'mp3',
      blockOrder: ['a'],
      charCount: 1,
      sourceModifiedAt: null,
    })
    await repository.upsertBlock({
      ttsId: en.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp-en',
      text: 'hi',
      url: 'https://cdn/en.mp3',
      storageBackend: 's3',
      storageKey: 'k/en',
    })
    await repository.upsertBlock({
      ttsId: ja.id,
      blockId: 'a',
      chunkIndex: 0,
      fingerprint: 'fp-ja',
      text: 'hi',
      url: 'https://cdn/ja.mp3',
      storageBackend: 's3',
      storageKey: 'k/ja',
    })

    const removed = await repository.deleteByRefId('5')
    expect(removed.map((b) => b.storageKey).sort()).toEqual(['k/en', 'k/ja'])
    expect(await repository.findAllByRef('5')).toEqual([])
  })

  it('listPaginated paginates rows and filters by search', async () => {
    await repository.upsertParent({
      refId: '6',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'gpt-tts',
      voice: 'alloy-unique',
      speed: 1,
      format: 'mp3',
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })
    await repository.upsertParent({
      refId: '7',
      lang: 'en',
      isTranslation: false,
      sourceLang: null,
      model: 'gpt-tts',
      voice: 'nova-unique',
      speed: 1,
      format: 'mp3',
      blockOrder: [],
      charCount: 0,
      sourceModifiedAt: null,
    })

    const all = await repository.listPaginated({ page: 1, size: 100 })
    expect(all.data.length).toBeGreaterThanOrEqual(2)
    expect(all.pagination.currentPage).toBe(1)

    const filtered = await repository.listPaginated({
      search: 'alloy-unique',
    })
    expect(filtered.data).toHaveLength(1)
    expect(filtered.data[0].refId).toBe('6')

    const byRefId = await repository.listPaginated({ search: '7' })
    expect(byRefId.data.some((row) => row.refId === '7')).toBe(true)
  })
})
