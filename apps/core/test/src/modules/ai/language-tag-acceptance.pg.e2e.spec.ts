import fs from 'node:fs'
import path from 'node:path'

import { drizzle } from 'drizzle-orm/node-postgres'
import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { toArticleContent } from '~/modules/ai/ai-translation/article-content.util'
import { TranslationConsistencyService } from '~/modules/ai/ai-translation/translation-consistency.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'
import { ContentFormat } from '~/shared/types/content-format.type'

const migrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../src/database/migrations/0047_language_tag_bcp47.sql',
  ),
  'utf8',
)

const REF_ID = '515151515151515151'

const document = {
  id: REF_ID,
  title: '标题',
  text: '正文',
  subtitle: null,
  summary: null,
  tags: [],
  contentFormat: ContentFormat.Markdown,
  content: null,
  isPublished: true,
  meta: { lang: 'zh-CN' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  modifiedAt: new Date('2099-01-01T00:00:00Z'),
}

describe('language tags after the BCP 47 migration (real PG)', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  let service: AiTranslationService

  beforeAll(async () => {
    context = await createPgTestDatabase('mx_language_tag_acceptance')
    const db = drizzle(context.pool) as unknown as AppDatabase
    const databaseService = {
      findGlobalById: async () => ({
        type: CollectionRefTypes.Post,
        document,
      }),
    }
    const consistency = new TranslationConsistencyService(
      databaseService as any,
    )
    const legacyHash = consistency.computeContentHash(
      toArticleContent(document as any),
      'zh',
    )
    await context.pool.query(
      `INSERT INTO ai_translations
         (id, created_at, hash, ref_id, ref_type, lang, source_lang, title, text)
       VALUES
         ('1', '2026-01-02', $1, $2, 'posts', 'en', 'zh', 'Title', 'Body'),
         ('2', '2026-01-03', $1, $2, 'posts', 'zh-tw', 'zh', '標題', '正文'),
         ('3', '2026-01-01', $1, $2, 'posts', 'ja', 'cn', 'old', 'old'),
         ('4', '2026-01-04', $1, $2, 'posts', 'ja-JP', 'zh', 'タイトル', '本文')`,
      [legacyHash, REF_ID],
    )

    await context.pool.query(migrationSql)

    service = new AiTranslationService(
      new AiTranslationRepository(db, new SnowflakeService()),
      databaseService as any,
      consistency,
      { build: () => null } as any,
      ...(Array.from({ length: 11 }, () => null) as [any]),
    )
  }, 120_000)

  afterAll(async () => {
    await context?.close()
  })

  it('keeps every migrated translation fresh against its pre-migration hash', async () => {
    const result = await service.getTranslationAndAvailableLanguages(
      REF_ID,
      'en',
    )
    expect(result.sourceLang).toBe('zh-CN')
    expect([...result.availableTranslations].sort()).toEqual([
      'en-US',
      'ja-JP',
      'zh-TW',
    ])
  })

  it.each([
    ['zh-TW', 'zh-TW', '標題'],
    ['zh-HK', 'zh-TW', '標題'],
    ['en', 'en-US', 'Title'],
    ['ja', 'ja-JP', 'タイトル'],
  ])('serves %s from the %s translation', async (requested, lang, title) => {
    const { translation } = await service.getTranslationAndAvailableLanguages(
      REF_ID,
      requested,
    )
    expect(translation?.lang).toBe(lang)
    expect(translation?.title).toBe(title)
  })

  it('serves the original for a Simplified Chinese request', async () => {
    const { translation } = await service.getTranslationAndAvailableLanguages(
      REF_ID,
      'zh',
    )
    expect(translation).toBeNull()
  })
})
