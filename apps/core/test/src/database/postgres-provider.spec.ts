import { eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { categories, posts } from '~/database/schema'
import {
  SNOWFLAKE_EPOCH_MS,
  SnowflakeGenerator,
} from '~/shared/id/snowflake.service'

/**
 * Integration smoke test. PG_VERIFY_URL must point at a reachable PostgreSQL
 * instance with privileges to apply the schema. Local development sets this
 * against an ephemeral docker container.
 */
describe('postgres provider smoke', () => {
  let context: PgTestDatabase
  let pool: Pool
  let db: PgTestDatabase['db']

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_provider')
    pool = context.pool
    db = context.db
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  it('round-trips a category and post via Snowflake text ids', async () => {
    const generator = new SnowflakeGenerator({ workerId: 7 })
    const categoryId = generator.nextId()
    const postId = generator.nextId()

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
    const generator = new SnowflakeGenerator({ workerId: 8 })
    const orphanId = generator.nextId()
    await expect(
      db.insert(posts).values({
        id: orphanId,
        title: 'orphan',
        slug: `orphan-${orphanId}`,
        contentFormat: 'markdown',
        categoryId: generator.nextId(),
      }),
    ).rejects.toThrow(/foreign key|category_id/i)
  })

  it('reads server-generated created_at as Date', async () => {
    const id = new SnowflakeGenerator({
      workerId: 9,
      epochMs: SNOWFLAKE_EPOCH_MS,
    }).nextId()
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
