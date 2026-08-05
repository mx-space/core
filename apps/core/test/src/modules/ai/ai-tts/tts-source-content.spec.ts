import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { toArticleContent } from '~/modules/ai/ai-translation/article-content.util'
import { resolveTtsSourceContent } from '~/modules/ai/ai-tts/tts-source-content'
import { computeContentHash } from '~/utils/content.util'

const LEXICAL = '{"root":{"children":[]}}'

const document = {
  title: 'Narratable post',
  text: 'plain text',
  contentFormat: 'lexical',
  content: LEXICAL,
  meta: { lang: 'zh-CN' },
  modifiedAt: new Date('2026-01-01'),
}

// The writer hashes the source article with `translated.sourceLang` and stores
// that same string on the row — see ai-translation.service.ts.
const translationRow = (overrides: Record<string, unknown> = {}) => {
  const sourceLang = (overrides.sourceLang as string) ?? 'zh'
  return {
    contentFormat: 'lexical',
    content: '{"root":{"children":[1]}}',
    sourceLang,
    hash: computeContentHash(toArticleContent(document as never), sourceLang),
    sourceModifiedAt: new Date('2025-06-01'),
    createdAt: new Date('2025-05-01'),
    ...overrides,
  }
}

function resolve(
  row: unknown,
  overrides: Record<string, unknown> = {},
): Promise<{ content: string; sourceModifiedAt: Date | null }> {
  return resolveTtsSourceContent({
    document: document as never,
    findTranslation: vi.fn(async () => row as never),
    isTranslation: true,
    lang: 'en',
    refId: '1',
    sourceLang: 'zh',
    ...overrides,
  })
}

describe('resolveTtsSourceContent', () => {
  describe('source language', () => {
    it('returns the article content stamped with the article mtime', async () => {
      await expect(
        resolve(null, { isTranslation: false, lang: 'zh' }),
      ).resolves.toEqual({
        content: LEXICAL,
        sourceModifiedAt: new Date('2026-01-01'),
      })
    })

    it('rejects a non-lexical article', async () => {
      await expect(
        resolveTtsSourceContent({
          document: { ...document, contentFormat: 'markdown' } as never,
          findTranslation: vi.fn(),
          isTranslation: false,
          lang: 'zh',
          refId: '1',
          sourceLang: 'zh',
        }),
      ).rejects.toMatchObject({ code: AppErrorCode.TTS_SOURCE_NOT_LEXICAL })
    })
  })

  describe('translated language', () => {
    it('accepts a fresh translation and stamps the translation vintage', async () => {
      await expect(resolve(translationRow())).resolves.toEqual({
        content: '{"root":{"children":[1]}}',
        sourceModifiedAt: new Date('2025-06-01'),
      })
    })

    it('accepts a fresh translation whose sourceLang carries a region subtag', async () => {
      await expect(
        resolve(translationRow({ sourceLang: 'zh-CN' })),
      ).resolves.toMatchObject({ content: '{"root":{"children":[1]}}' })
    })

    it('falls back to createdAt when the row has no source vintage', async () => {
      await expect(
        resolve(translationRow({ sourceModifiedAt: null })),
      ).resolves.toMatchObject({ sourceModifiedAt: new Date('2025-05-01') })
    })

    it('rejects a translation left behind by an edited article', async () => {
      await expect(
        resolve(translationRow({ hash: 'hash-of-an-older-article' })),
      ).rejects.toMatchObject({ code: AppErrorCode.TTS_SOURCE_NOT_LEXICAL })
    })

    it('rejects a missing translation row', async () => {
      await expect(resolve(null)).rejects.toMatchObject({
        code: AppErrorCode.TTS_SOURCE_NOT_LEXICAL,
      })
    })

    it('rejects a non-lexical translation', async () => {
      await expect(
        resolve(translationRow({ contentFormat: 'markdown' })),
      ).rejects.toMatchObject({ code: AppErrorCode.TTS_SOURCE_NOT_LEXICAL })
    })

    it('rejects a translation made from a different source language', async () => {
      await expect(
        resolve(translationRow({ sourceLang: 'en' })),
      ).rejects.toMatchObject({ code: AppErrorCode.TTS_SOURCE_NOT_LEXICAL })
    })
  })
})
