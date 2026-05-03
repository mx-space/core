import { existsSync } from 'node:fs'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { categories, posts } from '~/database/schema'
import {
  SNOWFLAKE_EPOCH_MS,
  SnowflakeGenerator,
} from '~/shared/id/snowflake.service'

/**
 * Integration smoke test. Skipped unless PG_VERIFY_URL points at a reachable
 * PostgreSQL instance with privileges to apply the schema. Local development
 * sets this against an ephemeral docker container.
 */
const verifyUrl = process.env.PG_VERIFY_URL
const describeIfPg = verifyUrl ? describe : describe.skip

describeIfPg('postgres provider smoke', () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle>

  beforeAll(async () => {
    pool = new Pool({ connectionString: verifyUrl })
    db = drizzle(pool, { casing: 'snake_case' })
    const migrationsFolder = path.resolve(
      __dirname,
      '../../../src/database/migrations',
    )
    if (!existsSync(migrationsFolder)) {
      throw new Error(`migrations folder missing: ${migrationsFolder}`)
    }
    await migrate(db, { migrationsFolder })
  }, 60_000)

  afterAll(async () => {
    if (pool) {
      await pool.query('truncate table posts cascade')
      await pool.query('truncate table categories cascade')
      await pool.end()
    }
  })

  it('round-trips a category and post via Snowflake bigint ids', async () => {
    const generator = new SnowflakeGenerator({ workerId: 7 })
    const categoryId = generator.nextBigInt()
    const postId = generator.nextBigInt()

    await db.insert(categories).values({
      id: categoryId,
      name: `cat-${categoryId}`,
      slug: `cat-${categoryId}`,
      type: 0,
    })

    await db.insert(posts).values({
      id: postId,
      title: 'hello',
      slug: `hello-${postId}`,
      contentFormat: 'markdown',
      categoryId,
    })

    const rows = await db.select().from(posts).where(eq(posts.id, postId))
    expect(rows).toHaveLength(1)
    expect(rows[0].categoryId).toBe(categoryId)
    expect(rows[0].title).toBe('hello')
  })

  it('rejects FK violation when inserting post with unknown category', async () => {
    const orphanId = new SnowflakeGenerator({ workerId: 8 }).nextBigInt()
    await expect(
      db.insert(posts).values({
        id: orphanId,
        title: 'orphan',
        slug: `orphan-${orphanId}`,
        contentFormat: 'markdown',
        categoryId: 999_999_999_999n,
      }),
    ).rejects.toThrow(/foreign key|category_id/i)
  })

  it('reads server-generated created_at as Date', async () => {
    const id = new SnowflakeGenerator({
      workerId: 9,
      epochMs: SNOWFLAKE_EPOCH_MS,
    }).nextBigInt()
    await db.insert(categories).values({
      id,
      name: `c-${id}`,
      slug: `c-${id}`,
    })
    const [row] = await db
      .select({ createdAt: categories.createdAt })
      .from(categories)
      .where(eq(categories.id, id))
    expect(row.createdAt).toBeInstanceOf(Date)
  })

  it('uses jsonb default for search_documents term-frequency columns', async () => {
    const result = await pool.query(
      'select pg_typeof(title_term_freq)::text from search_documents limit 0',
    )
    expect(result.rowCount).toBe(0)
    // Sanity check default literal compiled as jsonb at column level.
    const colInfo = await pool.query(
      `select data_type from information_schema.columns
       where table_name = 'search_documents' and column_name = 'title_term_freq'`,
    )
    expect(colInfo.rows[0].data_type).toBe('jsonb')
  })
})
