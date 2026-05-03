import path from 'node:path'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { posts } from '~/database/schema'
import {
  CategoryRepository,
  CategoryType,
} from '~/modules/category/category.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

const verifyUrl = process.env.PG_VERIFY_URL
const describeIfPg = verifyUrl ? describe : describe.skip

describeIfPg('CategoryRepository', () => {
  let pool: Pool
  let db: NodePgDatabase<typeof import('~/database/schema')>
  let repository: CategoryRepository
  let snowflake: SnowflakeService

  beforeAll(async () => {
    pool = new Pool({ connectionString: verifyUrl })
    db = drizzle(pool, { casing: 'snake_case' })
    const migrationsFolder = path.resolve(
      __dirname,
      '../../../../src/database/migrations',
    )
    await migrate(db, { migrationsFolder })
    snowflake = new SnowflakeService()
    repository = new CategoryRepository(db as any, snowflake)
  }, 60_000)

  beforeEach(async () => {
    await pool.query('truncate table posts cascade')
    await pool.query('truncate table categories cascade')
  })

  afterAll(async () => {
    if (pool) await pool.end()
  })

  it('creates a category with a generated Snowflake id', async () => {
    const created = await repository.create({
      name: 'tech',
      slug: 'tech',
    })
    expect(typeof created.id).toBe('string')
    expect(created.id).toMatch(/^[1-9]\d+$/)
    expect(created.name).toBe('tech')
    expect(created.type).toBe(CategoryType.Category)
    expect(created.createdAt).toBeInstanceOf(Date)
  })

  it('findAll returns categories with their post counts', async () => {
    const a = await repository.create({ name: 'a', slug: 'a' })
    const b = await repository.create({ name: 'b', slug: 'b' })

    const aBig = BigInt(a.id)
    await db.insert(posts).values([
      {
        id: snowflake.nextBigInt(),
        title: 'p1',
        slug: 'p1',
        contentFormat: 'markdown',
        categoryId: aBig,
      },
      {
        id: snowflake.nextBigInt(),
        title: 'p2',
        slug: 'p2',
        contentFormat: 'markdown',
        categoryId: aBig,
      },
    ])

    const list = await repository.findAll(CategoryType.Category)
    const aOut = list.find((c) => c.id === a.id)
    const bOut = list.find((c) => c.id === b.id)
    expect(aOut?.count).toBe(2)
    expect(bOut?.count).toBe(0)
  })

  it('findBySlug looks up by slug and returns null on miss', async () => {
    await repository.create({ name: 'foo', slug: 'foo' })
    const hit = await repository.findBySlug('foo')
    const miss = await repository.findBySlug('not-there')
    expect(hit?.name).toBe('foo')
    expect(miss).toBeNull()
  })

  it('update mutates only specified fields', async () => {
    const created = await repository.create({ name: 'old', slug: 'old' })
    const updated = await repository.update(created.id, { slug: 'new' })
    expect(updated?.slug).toBe('new')
    expect(updated?.name).toBe('old')
  })

  it('deleteById fails via FK restrict when posts reference the category', async () => {
    const created = await repository.create({ name: 'has', slug: 'has' })
    await db.insert(posts).values({
      id: snowflake.nextBigInt(),
      title: 'orphan-post',
      slug: 'orphan-post',
      contentFormat: 'markdown',
      categoryId: BigInt(created.id),
    })
    await expect(repository.deleteById(created.id)).rejects.toThrow(
      /foreign key|violates|posts/i,
    )
  })

  it('sumPostTags aggregates tag distribution per category', async () => {
    const cat = await repository.create({ name: 'cat', slug: 'cat' })
    const catBig = BigInt(cat.id)
    await db.insert(posts).values([
      {
        id: snowflake.nextBigInt(),
        title: 't1',
        slug: 't1',
        contentFormat: 'markdown',
        categoryId: catBig,
        tags: ['ts', 'pg'],
      },
      {
        id: snowflake.nextBigInt(),
        title: 't2',
        slug: 't2',
        contentFormat: 'markdown',
        categoryId: catBig,
        tags: ['ts'],
      },
    ])
    const tagSummary = await repository.sumPostTags({ categoryId: cat.id })
    const ts = tagSummary.find((t) => t.name === 'ts')
    const pg = tagSummary.find((t) => t.name === 'pg')
    expect(ts?.count).toBe(2)
    expect(pg?.count).toBe(1)
  })

  it('rejects parseEntityId failure on malformed input', async () => {
    await expect(repository.findById('not-an-id')).rejects.toThrow()
  })
})
