import { Injectable } from '@nestjs/common'

import { DatabaseService } from '~/processors/database/database.service'

import type { ArticleDocument } from './ai-translation.types'
import { AITranslationModel } from './ai-translation.types-model'
import { BaseTranslationService } from './base-translation.service'
import { type TranslationSourceSnapshot } from './translation-consistency.types'

export type FreshnessStatus = 'valid' | 'stale' | 'unknown'
type TranslationSnapshot = Pick<
  AITranslationModel,
  'refId' | 'hash' | 'sourceLang' | 'sourceModifiedAt' | 'createdAt'
>

@Injectable()
export class TranslationConsistencyService extends BaseTranslationService {
  constructor(private readonly databaseService: DatabaseService) {
    super()
  }

  partitionValidAndStaleTranslations(
    articles: TranslationSourceSnapshot[],
    translations: AITranslationModel[],
  ): {
    validTranslations: Map<string, AITranslationModel>
    unknownTranslations: Map<string, AITranslationModel>
    staleRefIds: string[]
  } {
    if (!articles.length || !translations.length) {
      return {
        validTranslations: new Map(),
        unknownTranslations: new Map(),
        staleRefIds: [],
      }
    }

    const translationMap = new Map<string, AITranslationModel>(
      translations.map((translation) => [
        translation.refId as string,
        translation,
      ]),
    )
    const validTranslations = new Map<string, AITranslationModel>()
    const unknownTranslations = new Map<string, AITranslationModel>()
    const staleRefIds = new Set<string>()

    for (const article of articles) {
      const translation = translationMap.get(article.id)
      if (!translation) {
        continue
      }

      const status = this.evaluateTranslationFreshness(article, translation)
      if (status === 'valid') {
        validTranslations.set(article.id, translation)
      } else if (status === 'stale') {
        staleRefIds.add(article.id)
      } else if (status === 'unknown') {
        unknownTranslations.set(article.id, translation)
      }
    }

    return {
      validTranslations,
      unknownTranslations,
      staleRefIds: [...staleRefIds],
    }
  }

  async filterTrulyStaleTranslations(
    translations: Array<
      Pick<AITranslationModel, 'refId' | 'hash' | 'sourceLang'>
    >,
  ): Promise<string[]> {
    if (!translations.length) {
      return []
    }

    const refIds = [
      ...new Set(
        translations
          .map((translation) => translation.refId as string)
          .filter((refId) => typeof refId === 'string'),
      ),
    ]
    const groupedArticles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap = this.databaseService.flatCollectionToMap(groupedArticles)
    const staleRefIds = new Set<string>()

    // Several translation rows often share a refId; hash each (article, lang)
    // pair once — canonicalizing a large lexical document is the costly part.
    const hashCache = new Map<string, string>()
    for (const translation of translations) {
      if (!translation.refId) {
        continue
      }
      const document = articleMap[translation.refId]
      if (!this.isTranslatableDocument(document)) {
        continue
      }

      const sourceLang =
        this.getMetaLang(document) || translation.sourceLang || 'unknown'
      const cacheKey = `${translation.refId}:${sourceLang}`
      let currentHash = hashCache.get(cacheKey)
      if (currentHash === undefined) {
        currentHash = this.computeContentHash(
          this.toArticleContent(document),
          sourceLang,
        )
        hashCache.set(cacheKey, currentHash)
      }

      if (translation.hash !== currentHash) {
        staleRefIds.add(translation.refId)
      }
    }

    return [...staleRefIds]
  }

  evaluateTranslationFreshness(
    article: TranslationSourceSnapshot,
    translation: TranslationSnapshot,
  ): FreshnessStatus {
    const articleTimestamp = article.modifiedAt ?? article.createdAt ?? null

    if (
      translation.sourceModifiedAt &&
      articleTimestamp &&
      translation.sourceModifiedAt >= articleTimestamp
    ) {
      return 'valid'
    }

    if (
      !translation.sourceModifiedAt &&
      articleTimestamp &&
      translation.createdAt &&
      translation.createdAt >= articleTimestamp
    ) {
      return 'valid'
    }

    if (!this.hasComparableSource(article)) {
      return 'unknown'
    }

    const sourceLang = article.meta?.lang || translation.sourceLang || 'unknown'
    return translation.hash === this.hashSnapshot(article, sourceLang)
      ? 'valid'
      : 'stale'
  }

  // Callers evaluate one snapshot object against many translation rows;
  // hashing canonicalizes the full lexical document, so memoize per
  // (snapshot identity, sourceLang) to pay that cost once per request.
  private readonly snapshotHashCache = new WeakMap<
    TranslationSourceSnapshot,
    Map<string, string>
  >()

  private hashSnapshot(
    article: TranslationSourceSnapshot,
    sourceLang: string,
  ): string {
    let perLang = this.snapshotHashCache.get(article)
    if (!perLang) {
      perLang = new Map()
      this.snapshotHashCache.set(article, perLang)
    }
    const cached = perLang.get(sourceLang)
    if (cached !== undefined) return cached

    const hash = this.computeContentHash(
      {
        title: article.title,
        text: article.text ?? '',
        subtitle: article.subtitle,
        summary: article.summary ?? undefined,
        tags: article.tags,
        contentFormat: article.contentFormat,
        content: article.content,
      },
      sourceLang,
    )
    perLang.set(sourceLang, hash)
    return hash
  }

  private hasComparableSource(article: TranslationSourceSnapshot): boolean {
    // Empty string is the documented signal from list endpoints whose SQL-side
    // truncation leaves no usable body to hash — fall through to 'unknown' so
    // the caller can re-verify against the full document loaded from the DB.
    const hasText = typeof article.text === 'string' && article.text.length > 0
    const hasContent =
      typeof article.content === 'string' && article.content.length > 0
    return hasText || hasContent
  }

  private isTranslatableDocument(
    document: unknown,
  ): document is ArticleDocument {
    if (!document || typeof document !== 'object') return false
    const value = document as Record<string, unknown>
    return typeof value.title === 'string' && typeof value.text === 'string'
  }
}
