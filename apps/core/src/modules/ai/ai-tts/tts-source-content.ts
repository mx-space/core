import { AppErrorCode, createAppException } from '~/common/errors'
import { computeContentHash } from '~/utils/content.util'

import { parseLanguageCode } from '../ai-language.util'
import type {
  AiTranslationRow,
  ArticleDocument,
} from '../ai-translation/ai-translation.types'
import { toArticleContent } from '../ai-translation/article-content.util'
import type { TtsSourceDocument } from './ai-tts.types'

export interface TtsSourceContent {
  content: string
  sourceModifiedAt: Date | null
}

export async function resolveTtsSourceContent(params: {
  document: TtsSourceDocument
  findTranslation: (
    refId: string,
    lang: string,
  ) => Promise<AiTranslationRow | null>
  isTranslation: boolean
  lang: string
  refId: string
  sourceLang: string
}): Promise<TtsSourceContent> {
  const { document, findTranslation, isTranslation, lang, refId, sourceLang } =
    params

  if (!isTranslation) {
    if (document.contentFormat !== 'lexical' || !document.content) {
      throw createAppException(AppErrorCode.TTS_SOURCE_NOT_LEXICAL, { lang })
    }
    return {
      content: document.content,
      sourceModifiedAt: document.modifiedAt ?? null,
    }
  }

  const row = await findTranslation(refId, lang)
  if (
    !row ||
    row.contentFormat !== 'lexical' ||
    !row.content ||
    parseLanguageCode(row.sourceLang) !== sourceLang
  ) {
    throw createAppException(AppErrorCode.TTS_SOURCE_NOT_LEXICAL, { lang })
  }

  // Same hash the translation module compares on, via the same helper, so a
  // translation left behind by an edited article is never voiced.
  const currentHash = computeContentHash(
    toArticleContent(document as unknown as ArticleDocument),
    sourceLang,
  )
  if (row.hash !== currentHash) {
    throw createAppException(AppErrorCode.TTS_SOURCE_NOT_LEXICAL, { lang })
  }

  // The narration is only as current as the translation it was voiced from, so
  // the row carries the translation's vintage rather than the article's —
  // otherwise a months-old translation reads back as fresh.
  return {
    content: row.content,
    sourceModifiedAt: row.sourceModifiedAt ?? row.createdAt ?? null,
  }
}
