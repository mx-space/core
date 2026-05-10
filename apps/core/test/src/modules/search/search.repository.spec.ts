import path from 'node:path'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { SearchRepository } from '~/modules/search/search.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

const verifyUrl = process.env.PG_VERIFY_URL
const describeIfPg = verifyUrl ? describe : describe.skip

const baseDoc = (overrides: Record<string, any> = {}) => ({
  refType: 'post' as const,
  refId: '1234567890123456789',
  lang: 'zh',
  sourceHash: 'h-zh',
  title: '中文标题',
  searchText: '正文',
  terms: ['中文标题', '正文'],
  titleTermFreq: { 中文标题: 1 },
  bodyTermFreq: { 正文: 1 },
  titleLength: 4,
  bodyLength: 2,
  slug: null,
  nid: null,
  isPublished: true,
  publicAt: null,
  hasPassword: false,
  modifiedAt: null,
  ...overrides,
})

describeIfPg('SearchRepository', () => {
  let pool: Pool
  let db: NodePgDatabase<typeof import('~/database/schema')>
  let repo: SearchRepository

  beforeAll(async () => {
    pool = new Pool({ connectionString: verifyUrl })
    db = drizzle(pool, { casing: 'snake_case' })
    const migrationsFolder = path.resolve(
      __dirname,
      '../../../../src/database/migrations',
    )
    await migrate(db, { migrationsFolder })
    repo = new SearchRepository(db as any, new SnowflakeService())
  }, 60_000)

  beforeEach(async () => {
    await pool.query('truncate table search_documents cascade')
  })

  afterAll(async () => {
    if (pool) await pool.end()
  })

  it('upserts the same (refType, refId, lang) without violating unique', async () => {
    await repo.upsert(baseDoc())
    await repo.upsert(baseDoc({ title: '改' }))
    const all = await repo.findAll('post')
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('改')
  })

  it('keeps lang variants distinct in the unique index', async () => {
    await repo.upsert(baseDoc({ lang: 'zh' }))
    await repo.upsert(
      baseDoc({
        lang: 'en',
        sourceHash: 'h-en',
        title: 'english',
        terms: ['english'],
        titleTermFreq: { english: 1 },
      }),
    )
    expect((await repo.findAll('post')).length).toBe(2)
    const zh = await repo.findByRef('post', '1234567890123456789', 'zh')
    const en = await repo.findByRef('post', '1234567890123456789', 'en')
    expect(zh?.lang).toBe('zh')
    expect(en?.lang).toBe('en')
  })

  it('deleteByRef without lang drops every variant', async () => {
    await repo.upsert(baseDoc({ lang: 'zh' }))
    await repo.upsert(baseDoc({ lang: 'en', sourceHash: 'h-en', title: 'en' }))
    await repo.deleteByRef('post', '1234567890123456789')
    expect(await repo.findAll('post')).toHaveLength(0)
  })

  it('deleteByRef with lang only drops that variant', async () => {
    await repo.upsert(baseDoc({ lang: 'zh' }))
    await repo.upsert(baseDoc({ lang: 'en', sourceHash: 'h-en', title: 'en' }))
    await repo.deleteByRef('post', '1234567890123456789', 'zh')
    const remaining = await repo.findAll('post')
    expect(remaining.map((r) => r.lang)).toEqual(['en'])
  })

  it('findCorpusStatsByLang aggregates per language', async () => {
    await repo.upsert(baseDoc({ lang: 'zh', titleLength: 5, bodyLength: 10 }))
    await repo.upsert(
      baseDoc({
        lang: 'zh',
        refId: '2222222222222222222',
        sourceHash: 'h2',
        titleLength: 7,
        bodyLength: 20,
      }),
    )
    await repo.upsert(
      baseDoc({
        lang: 'en',
        sourceHash: 'h-en',
        title: 'english',
        terms: ['english'],
        titleTermFreq: { english: 1 },
        titleLength: 100,
        bodyLength: 200,
      }),
    )

    const zh = await repo.findCorpusStatsByLang('zh', 'post', {
      hasAdminAccess: true,
    })
    expect(zh.totalDocs).toBe(2)
    expect(zh.avgTitleLength).toBe(6)
    expect(zh.avgBodyLength).toBe(15)

    const en = await repo.findCorpusStatsByLang('en', 'post', {
      hasAdminAccess: true,
    })
    expect(en.totalDocs).toBe(1)
    expect(en.avgTitleLength).toBe(100)
  })

  it('findHashesByRefMap returns one entry per (refType, refId, lang)', async () => {
    await repo.upsert(baseDoc({ lang: 'zh', sourceHash: 'h1' }))
    await repo.upsert(baseDoc({ lang: 'en', sourceHash: 'h2' }))
    const map = await repo.findHashesByRefMap()
    expect(map.get('post:1234567890123456789:zh')).toBe('h1')
    expect(map.get('post:1234567890123456789:en')).toBe('h2')
    expect(map.size).toBe(2)
  })

  it('findAdminRows applies refType + lang + keyword filters', async () => {
    await repo.upsert(baseDoc({ lang: 'zh', title: '中文资讯' }))
    await repo.upsert(
      baseDoc({
        lang: 'en',
        refId: '3333333333333333333',
        sourceHash: 'h-en',
        title: 'English news',
      }),
    )
    const filtered = await repo.findAdminRows({
      refType: 'post',
      lang: 'en',
      keyword: 'english',
      page: 1,
      size: 20,
    })
    expect(filtered.data).toHaveLength(1)
    expect(filtered.data[0].title).toBe('English news')
  })
})
