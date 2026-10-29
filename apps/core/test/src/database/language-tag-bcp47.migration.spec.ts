import fs from 'node:fs'
import path from 'node:path'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { describe, expect, it } from 'vitest'

const migrationsDir = path.resolve(
  __dirname,
  '../../../src/database/migrations',
)

const migrationSql = fs.readFileSync(
  path.join(migrationsDir, '0047_language_tag_bcp47.sql'),
  'utf8',
)

const journalTags = (): string[] =>
  JSON.parse(
    fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ).entries.map((entry: { tag: string }) => entry.tag)

type Pool = { query: (sql: string, params?: unknown[]) => Promise<any> }

const seedLegacyRows = async (pool: Pool) => {
  await pool.query(`
    INSERT INTO ai_summaries (id, created_at, hash, summary, ref_id, lang, source_lang) VALUES
      ('101', '2026-01-01', 'h', 'old zh', 'r1', 'zh', NULL),
      ('102', '2026-02-01', 'h', 'new zh-CN', 'r1', 'zh-CN', NULL),
      ('103', '2026-03-01', 'h', 'newest en', 'r1', 'en', 'zh'),
      ('104', '2026-01-01', 'h', 'old en-US', 'r1', 'en-US', 'zh'),
      ('105', '2026-01-01', 'h', 'traditional', 'r1', 'tw', 'zh'),
      ('106', '2026-01-01', 'h', 'no lang', 'r2', NULL, NULL),
      ('107', '2026-01-01', 'h', 'klingon', 'r2', 'tlh-xx', NULL)
  `)
  await pool.query(`
    INSERT INTO ai_insights (id, created_at, ref_id, lang, hash, content, source_lang) VALUES
      ('201', '2026-01-01', 'r1', 'ja', 'h', 'old', 'zh'),
      ('202', '2026-02-01', 'r1', 'ja-JP', 'h', 'new', 'zh'),
      ('203', '2026-01-01', 'r1', 'zh', 'h', 'source', NULL)
  `)
  await pool.query(`
    INSERT INTO ai_translations (id, created_at, updated_at, hash, ref_id, ref_type, lang, source_lang, title, text) VALUES
      ('301', '2026-01-01', NULL, 'h', 'r1', 'post', 'en', 'zh', 't', 'x'),
      ('302', '2026-01-01', NULL, 'h', 'r1', 'post', 'zh-tw', 'cn', 't', 'x'),
      ('303', '2026-01-01', NULL, 'h', 'r1', 'post', 'kr', 'zh', 't', 'x'),
      ('304', '2026-01-01', '2026-04-01', 'h', 'r2', 'post', 'ja', 'zh', 't', 'retranslated'),
      ('305', '2026-02-01', NULL, 'h', 'r2', 'post', 'ja-JP', 'zh', 't', 'stale'),
      ('306', '2026-01-01', '2026-01-15', 'h', 'r3', 'post', 'en', 'zh', 't', 'stale'),
      ('307', '2026-02-01', NULL, 'h', 'r3', 'post', 'en-US', 'zh', 't', 'newer')
  `)
  await pool.query(`
    INSERT INTO ai_tts (id, created_at, ref_id, lang, source_lang, model, voice) VALUES
      ('401', '2026-01-01', 'r1', 'zh', NULL, 'm', 'v'),
      ('402', '2026-01-01', 'r1', 'en', 'zh', 'm', 'v')
  `)
  await pool.query(`
    INSERT INTO translation_entries (id, created_at, key_path, lang, key_type, lookup_key, source_text, translated_text) VALUES
      ('501', '2026-01-01', 'category.name', 'en', 'entity', 'k', 's', 'old'),
      ('502', '2026-02-01', 'category.name', 'en-US', 'entity', 'k', 's', 'new'),
      ('503', '2026-01-01', 'category.name', 'ja', 'entity', 'k', 's', 'ja')
  `)
  await pool.query(`
    INSERT INTO search_documents (id, created_at, ref_type, ref_id, lang, title, search_text) VALUES
      ('601', '2026-01-01', 'post', 'r1', 'zh', 't', 's'),
      ('602', '2026-01-01', 'post', 'r1', 'en', 't', 's')
  `)
  await pool.query(`
    INSERT INTO ai_generation_metrics (id, resource_type, resource_id, ref_id, lang) VALUES
      ('701', 'summary', '101', 'r1', 'jp'),
      ('702', 'summary', '102', 'r1', NULL)
  `)
  await pool.query(`
    INSERT INTO pages (id, title, slug, text, content_format, meta) VALUES
      ('801', 'p', 'p1', '', 'markdown', '{"lang":"zh","cover":"c"}'),
      ('802', 'p', 'p2', '', 'markdown', '{"cover":"c"}'),
      ('803', 'p', 'p3', '', 'markdown', NULL)
  `)
  await pool.query(`
    INSERT INTO comments (id, ref_type, ref_id, text, anchor) VALUES
      ('901', 'posts', 'r1', 'c', '{"mode":"range","lang":"en","quote":"q"}'),
      ('902', 'posts', 'r1', 'c', '{"mode":"block","lang":null}')
  `)
  await pool.query(
    `INSERT INTO options (id, name, value) VALUES ('1001', 'ai', $1), ('1002', 'seo', $2)`,
    [
      {
        enableSummary: true,
        summaryTargetLanguages: ['zh', 'en', 'en-US', 'tw'],
        translationTargetLanguages: ['en', 'jp', 'kr'],
        insightsTargetLanguages: [],
      },
      { title: 'site', translationTargetLanguages: ['en'] },
    ],
  )
}

const langs = async (pool: Pool, table: string, column = 'lang') => {
  const { rows } = await pool.query(
    `SELECT id::text AS id, ${column} AS value FROM ${table} ORDER BY id`,
  )
  return Object.fromEntries(rows.map((row: any) => [row.id, row.value]))
}

describe('language tag bcp47 migration', () => {
  it('is journalled', () => {
    expect(journalTags()).toContain('0047_language_tag_bcp47')
  })

  it('canonicalizes legacy tags idempotently, keeping the newest row on conflict', async () => {
    const context = await createPgTestDatabase('mx_language_tag_bcp47')
    const { pool } = context
    try {
      await seedLegacyRows(pool)

      await pool.query(migrationSql)
      await pool.query(migrationSql)

      expect(await langs(pool, 'ai_summaries')).toEqual({
        '102': 'zh-CN',
        '103': 'en-US',
        '105': 'zh-TW',
        '106': null,
        '107': 'tlh-xx',
      })
      expect(await langs(pool, 'ai_summaries', 'source_lang')).toMatchObject({
        '103': 'zh-CN',
        '105': 'zh-CN',
      })
      expect(await langs(pool, 'ai_insights')).toEqual({
        '202': 'ja-JP',
        '203': 'zh-CN',
      })
      expect(await langs(pool, 'ai_insights', 'source_lang')).toEqual({
        '202': 'zh-CN',
        '203': null,
      })
      expect(await langs(pool, 'ai_translations')).toEqual({
        '301': 'en-US',
        '302': 'zh-TW',
        '303': 'ko-KR',
        '304': 'ja-JP',
        '307': 'en-US',
      })
      expect(await langs(pool, 'ai_translations', 'source_lang')).toEqual({
        '301': 'zh-CN',
        '302': 'zh-CN',
        '303': 'zh-CN',
        '304': 'zh-CN',
        '307': 'zh-CN',
      })
      expect(await langs(pool, 'ai_tts')).toEqual({
        '401': 'zh-CN',
        '402': 'en-US',
      })
      expect(await langs(pool, 'ai_tts', 'source_lang')).toEqual({
        '401': null,
        '402': 'zh-CN',
      })
      expect(await langs(pool, 'translation_entries')).toEqual({
        '502': 'en-US',
        '503': 'ja-JP',
      })
      expect(await langs(pool, 'search_documents')).toEqual({
        '601': 'zh-CN',
        '602': 'en-US',
      })
      expect(await langs(pool, 'ai_generation_metrics')).toEqual({
        '701': 'ja-JP',
        '702': null,
      })
      expect(await langs(pool, 'pages', 'meta')).toEqual({
        '801': { lang: 'zh-CN', cover: 'c' },
        '802': { cover: 'c' },
        '803': null,
      })
      expect(await langs(pool, 'comments', 'anchor')).toEqual({
        '901': { mode: 'range', lang: 'en-US', quote: 'q' },
        '902': { mode: 'block', lang: null },
      })

      const { rows } = await pool.query(
        `SELECT name, value FROM options ORDER BY name`,
      )
      expect(rows).toEqual([
        {
          name: 'ai',
          value: {
            enableSummary: true,
            summaryTargetLanguages: ['zh-CN', 'en-US', 'zh-TW'],
            translationTargetLanguages: ['en-US', 'ja-JP', 'ko-KR'],
            insightsTargetLanguages: [],
          },
        },
        {
          name: 'seo',
          value: { title: 'site', translationTargetLanguages: ['en'] },
        },
      ])
    } finally {
      await context.close()
    }
  }, 120_000)
})
