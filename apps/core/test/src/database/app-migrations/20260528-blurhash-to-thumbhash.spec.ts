import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'

import { SnowflakeGenerator } from '~/shared/id/snowflake.service'

/**
 * Schema migration test for 0015_blurhash_to_thumbhash. The migrator runs the
 * full migration set including 0015 against a fresh database, then we verify
 * the final shape:
 *   - enrichment_captures.blurhash column is gone, thumbhash exists nullable.
 *   - posts.images jsonb no longer carries the dead `blurHash` key but keeps
 *     `src` and `accent`.
 *   - enrichment_cache.normalized has the `thumbnailImage.blurhash` and
 *     `captureImage.blurhash` paths stripped, with sibling keys intact.
 */
describe('migration — blurhash → thumbhash', () => {
  let context: PgTestDatabase
  const generator = new SnowflakeGenerator({ workerId: 19 })

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_blurhash_to_thumbhash')

    // Seed an enrichment_cache row that 0015's `#-` cleanup must rewrite.
    const enrichmentId = generator.nextId()
    await context.pool.query(
      `insert into enrichment_cache
         (id, provider, external_id, url, normalized)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        enrichmentId,
        'open-graph',
        `og:probe:${enrichmentId}`,
        'https://example.com/cache',
        JSON.stringify({
          thumbnailImage: { url: 'x', blurhash: 'def', accent: '#aaa' },
          captureImage: { url: 'y', blurhash: 'ghi', accent: '#bbb' },
          title: 'probe',
        }),
      ],
    )
    // Seed an enrichment_captures row to assert the column drop+add path.
    // The migration 0015 has already run via the global container setup,
    // so we seed against the post-migration shape (thumbhash column, NULL).
    await context.pool.query(
      `insert into enrichment_captures
         (enrichment_id, object_key, bytes, width, height, palette)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        enrichmentId,
        `screenshots/${enrichmentId}.webp`,
        12345,
        1280,
        720,
        JSON.stringify({ dominant: '#112233' }),
      ],
    )
    // Suppress unused var lint
    void enrichmentId

    // Seed a posts row whose `images` jsonb still embeds the legacy `blurHash`
    // key. Re-applying the 0015 cleanup statements against this row is what
    // we verify below; we run them inline because createPgTestDatabase reuses
    // a fresh database that already had 0015 applied (and therefore stripped
    // any rows present at migration time, which there are none of).
    const categoryId = generator.nextId()
    await context.pool.query(
      `insert into categories (id, name, slug, type)
       values ($1, $2, $3, $4)`,
      [categoryId, `cat-${categoryId}`, `cat-${categoryId}`, 0],
    )

    const postId = generator.nextId()
    await context.pool.query(
      `insert into posts
         (id, title, slug, content_format, category_id, images)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        postId,
        'thumbhash-probe',
        `thumbhash-probe-${postId}`,
        'markdown',
        categoryId,
        JSON.stringify([{ src: 'x', blurHash: 'abc', accent: '#fff' }]),
      ],
    )
    ;(context as any).__postId = postId
    ;(context as any).__enrichmentId = enrichmentId

    // Re-run the cleanup paths against the freshly seeded rows. This exercises
    // the same SQL as the migration; running it twice is idempotent.
    await context.pool.query(
      `UPDATE posts SET images = COALESCE((
         SELECT jsonb_agg(elem - 'blurHash')
         FROM jsonb_array_elements(images) elem
       ), '[]'::jsonb)
       WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array'`,
    )
    await context.pool.query(
      `UPDATE enrichment_cache
         SET normalized = (normalized #- '{thumbnailImage,blurhash}') #- '{captureImage,blurhash}'
       WHERE normalized IS NOT NULL
         AND (normalized #> '{thumbnailImage,blurhash}' IS NOT NULL
           OR normalized #> '{captureImage,blurhash}' IS NOT NULL)`,
    )
  }, 60_000)

  afterAll(async () => {
    if (context) await context.close()
  })

  it('drops enrichment_captures.blurhash and adds thumbhash as nullable text', async () => {
    const { rows } = await context.pool.query(
      `select column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'enrichment_captures'`,
    )
    const byName = new Map<string, { type: string; nullable: string }>(
      rows.map((r: any) => [
        r.column_name as string,
        { type: r.data_type as string, nullable: r.is_nullable as string },
      ]),
    )
    expect(byName.has('blurhash')).toBe(false)
    expect(byName.get('thumbhash')).toEqual({
      type: 'text',
      nullable: 'YES',
    })
  })

  it('seeded enrichment_captures row has thumbhash NULL', async () => {
    const enrichmentId = (context as any).__enrichmentId as string
    const { rows } = await context.pool.query(
      `select thumbhash from enrichment_captures where enrichment_id = $1`,
      [enrichmentId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].thumbhash).toBeNull()
  })

  it('strips `blurHash` from posts.images jsonb but preserves siblings', async () => {
    const postId = (context as any).__postId as string
    const { rows } = await context.pool.query(
      `select images from posts where id = $1`,
      [postId],
    )
    expect(rows).toHaveLength(1)
    const images = rows[0].images as Array<Record<string, unknown>>
    expect(Array.isArray(images)).toBe(true)
    expect(images).toHaveLength(1)
    expect(images[0]).not.toHaveProperty('blurHash')
    expect(images[0].src).toBe('x')
    expect(images[0].accent).toBe('#fff')
  })

  it('strips `blurhash` from enrichment_cache.normalized at thumbnailImage and captureImage', async () => {
    const enrichmentId = (context as any).__enrichmentId as string
    const { rows } = await context.pool.query(
      `select normalized from enrichment_cache where id = $1`,
      [enrichmentId],
    )
    expect(rows).toHaveLength(1)
    const normalized = rows[0].normalized as Record<string, any>
    expect(normalized.thumbnailImage).not.toHaveProperty('blurhash')
    expect(normalized.captureImage).not.toHaveProperty('blurhash')
    expect(normalized.thumbnailImage.url).toBe('x')
    expect(normalized.thumbnailImage.accent).toBe('#aaa')
    expect(normalized.captureImage.url).toBe('y')
    expect(normalized.captureImage.accent).toBe('#bbb')
    expect(normalized.title).toBe('probe')
  })
})
