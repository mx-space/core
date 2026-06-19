import { randomUUID } from 'node:crypto'

import { SnowflakeGenerator } from '@mx-space/db-schema/id'

import type { E2EBackend } from './e2e-app'

export interface AiFixture {
  categoryId: string
  postId: string
  postSlug: string
  summaryId: string
  translationId: string
  translationLang: string
  translationEntryId: string
  insightId: string
}

const snowflake = new SnowflakeGenerator({
  workerId: Number(process.env.SNOWFLAKE_WORKER_ID ?? 1),
  epochMs: 1746144000000n,
})

export async function seedAiFixture(backend: E2EBackend): Promise<AiFixture> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const categoryId = snowflake.nextId()
  const postId = snowflake.nextId()
  const summaryId = snowflake.nextId()
  const translationId = snowflake.nextId()
  const translationEntryId = snowflake.nextId()
  const insightId = snowflake.nextId()
  const postSlug = `e2e-ai-${suffix}`
  const translationLang = 'zh-CN'

  await backend.pgPool.query(
    `
      INSERT INTO categories (id, created_at, name, slug, type)
      VALUES ($1, NOW(), $2, $3, 0)
    `,
    [categoryId, `E2E AI ${suffix}`, `cat-${suffix}`],
  )

  await backend.pgPool.query(
    `
      INSERT INTO posts (
        id, created_at, title, slug, text, content,
        content_format, summary, category_id,
        copyright, is_published, read_count, like_count
      )
      VALUES ($1, NOW(), $2, $3, $4, $4, 'markdown', $5, $6,
              true, true, 0, 0)
    `,
    [
      postId,
      `E2E AI post ${suffix}`,
      postSlug,
      'sample body for AI fixtures',
      'sample summary',
      categoryId,
    ],
  )

  await backend.pgPool.query(
    `
      INSERT INTO ai_summaries (id, created_at, hash, summary, ref_id, lang)
      VALUES ($1, NOW(), $2, $3, $4, $5)
    `,
    [summaryId, `hash_${suffix}`, 'sample AI summary text', postId, 'en'],
  )

  await backend.pgPool.query(
    `
      INSERT INTO ai_translations (
        id, created_at, hash, ref_id, ref_type, lang, source_lang,
        title, text, content_format, content, tags
      )
      VALUES ($1, NOW(), $2, $3, 'post', $4, 'en',
              $5, $6, 'markdown', $6, '{}'::text[])
    `,
    [
      translationId,
      `trhash_${suffix}`,
      postId,
      translationLang,
      `E2E AI post ${suffix} (zh)`,
      'sample translated body',
    ],
  )

  await backend.pgPool.query(
    `
      INSERT INTO translation_entries (
        id, created_at, key_path, lang, key_type,
        lookup_key, source_text, translated_text
      )
      VALUES ($1, NOW(), $2, $3, 'page', $4, 'Hello', '你好')
    `,
    [
      translationEntryId,
      `e2e/${suffix}/greeting`,
      translationLang,
      `entry-${suffix}`,
    ],
  )

  await backend.pgPool.query(
    `
      INSERT INTO ai_insights (
        id, created_at, ref_id, lang, hash, content, is_translation
      )
      VALUES ($1, NOW(), $2, 'en', $3, $4, false)
    `,
    [insightId, postId, `inshash_${suffix}`, 'sample insight content'],
  )

  return {
    categoryId,
    postId,
    postSlug,
    summaryId,
    translationId,
    translationLang,
    translationEntryId,
    insightId,
  }
}
