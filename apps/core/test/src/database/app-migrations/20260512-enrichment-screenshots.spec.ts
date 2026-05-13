import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { enrichmentCache, enrichmentScreenshots } from '~/database/schema'
import { SnowflakeGenerator } from '~/shared/id/snowflake.service'

/**
 * Schema migration test for 0011_enrichment_screenshots. Verifies the new
 * table exists with the expected columns/types, the ON DELETE CASCADE link
 * to enrichment_cache fires, and the LRU index is present.
 */
describe('migration 0011 — enrichment_screenshots', () => {
  let context: PgTestDatabase

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_enrichment_screenshots')
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  it('creates enrichment_screenshots with the spec column types', async () => {
    const { rows } = await context.pool.query(
      `select column_name, data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'enrichment_screenshots'
        order by ordinal_position`,
    )

    const byName = new Map<
      string,
      { type: string; nullable: string; default: string | null }
    >(
      rows.map((r: any) => [
        r.column_name as string,
        {
          type: r.data_type as string,
          nullable: r.is_nullable as string,
          default: (r.column_default as string | null) ?? null,
        },
      ]),
    )

    expect(byName.get('enrichment_id')).toEqual({
      type: 'text',
      nullable: 'NO',
      default: null,
    })
    expect(byName.get('object_key')).toEqual({
      type: 'text',
      nullable: 'NO',
      default: null,
    })
    expect(byName.get('bytes')).toEqual({
      type: 'integer',
      nullable: 'NO',
      default: null,
    })
    expect(byName.get('width')).toEqual({
      type: 'integer',
      nullable: 'NO',
      default: null,
    })
    expect(byName.get('height')).toEqual({
      type: 'integer',
      nullable: 'NO',
      default: null,
    })
    expect(byName.get('blurhash')).toEqual({
      type: 'text',
      nullable: 'YES',
      default: null,
    })
    expect(byName.get('palette')).toEqual({
      type: 'jsonb',
      nullable: 'YES',
      default: null,
    })
    expect(byName.get('created_at')).toEqual({
      type: 'timestamp with time zone',
      nullable: 'NO',
      default: 'now()',
    })
    expect(byName.get('last_accessed_at')).toEqual({
      type: 'timestamp with time zone',
      nullable: 'NO',
      default: 'now()',
    })
  })

  it('declares enrichment_id as the primary key', async () => {
    const { rows } = await context.pool.query(
      `select kcu.column_name
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on tc.constraint_name = kcu.constraint_name
          and tc.table_schema = kcu.table_schema
        where tc.table_schema = 'public'
          and tc.table_name = 'enrichment_screenshots'
          and tc.constraint_type = 'PRIMARY KEY'`,
    )
    expect(rows.map((r: any) => r.column_name)).toEqual(['enrichment_id'])
  })

  it('exposes the LRU index on last_accessed_at', async () => {
    const { rows } = await context.pool.query(
      `select indexdef
         from pg_indexes
        where schemaname = 'public'
          and tablename = 'enrichment_screenshots'
          and indexname = 'enrichment_screenshots_lru_idx'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].indexdef).toMatch(/last_accessed_at/i)
  })

  it('cascades deletes from enrichment_cache to enrichment_screenshots', async () => {
    const generator = new SnowflakeGenerator({ workerId: 17 })
    const enrichmentId = generator.nextId()

    await context.db.insert(enrichmentCache).values({
      id: enrichmentId,
      provider: 'open-graph',
      externalId: `og:test:${enrichmentId}`,
      url: 'https://example.com/cascade',
      normalized: { title: 'cascade probe' } as Record<string, unknown>,
      raw: null,
    })

    const objectKey = `screenshots/${enrichmentId}.webp`
    const palette = { dominant: '#112233' }
    await context.db.insert(enrichmentScreenshots).values({
      enrichmentId,
      objectKey,
      bytes: 12345,
      width: 1280,
      height: 720,
      blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      palette,
    })

    const beforeRows = await context.pool.query(
      `select object_key, palette from enrichment_screenshots where enrichment_id = $1`,
      [enrichmentId],
    )
    expect(beforeRows.rowCount).toBe(1)
    expect(beforeRows.rows[0].object_key).toBe(objectKey)
    // node-postgres parses jsonb into a JS object, so this asserts the column
    // is jsonb (or json) and round-trips the structure we inserted.
    expect(beforeRows.rows[0].palette).toEqual(palette)

    await context.pool.query(`delete from enrichment_cache where id = $1`, [
      enrichmentId,
    ])

    const afterCount = await context.pool.query(
      `select count(*)::int as n from enrichment_screenshots where enrichment_id = $1`,
      [enrichmentId],
    )
    expect(afterCount.rows[0].n).toBe(0)
  })
})
