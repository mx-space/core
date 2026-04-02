import { Injectable } from '@nestjs/common'

import { DatabaseService } from '~/processors/database/database.service'

import { AITranslationModel } from './ai-translation.model'
import type { ArticleDocument } from './ai-translation.types'
import { BaseTranslationService } from './base-translation.service'
import {
  TRANSLATION_VALIDATION_DEFAULT_SELECT,
  TRANSLATION_VALIDATION_REQUIRED_SELECT_FIELDS,
  type TranslationSourceSnapshot,
} from './translation-consistency.types'

export type FreshnessStatus = 'valid' | 'stale' | 'unknown'
type TranslationSnapshot = Pick<
  AITranslationModel,
  'refId' | 'hash' | 'sourceLang' | 'sourceModified' | 'created'
>

@Injectable()
export class TranslationConsistencyService extends BaseTranslationService {
  constructor(private readonly databaseService: DatabaseService) {
    super()
  }

  buildValidationSelect(select?: string): string {
    if (!select) {
      return TRANSLATION_VALIDATION_DEFAULT_SELECT
    }
    return `${select} ${TRANSLATION_VALIDATION_REQUIRED_SELECT_FIELDS.join(' ')}`
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

    const translationMap = new Map(
      translations.map((translation) => [translation.refId, translation]),
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

    const refIds = [...new Set(translations.map((t) => t.refId))]
    const groupedArticles = await this.databaseService.findGlobalByIds(refIds)
    const articleMap = this.databaseService.flatCollectionToMap(groupedArticles)
    const staleRefIds = new Set<string>()

    for (const translation of translations) {
      const document = articleMap[translation.refId]
      if (!this.isTranslatableDocument(document)) {
        continue
      }

      const sourceLang =
        this.getMetaLang(document) || translation.sourceLang || 'unknown'
      const currentHash = this.computeContentHash(
        this.toArticleContent(document),
        sourceLang,
      )

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
    const articleTimestamp = article.modified ?? article.created ?? null

    if (
      translation.sourceModified &&
      articleTimestamp &&
      translation.sourceModified >= articleTimestamp
    ) {
      return 'valid'
    }

    if (
      !translation.sourceModified &&
      articleTimestamp &&
      translation.created &&
      translation.created >= articleTimestamp
    ) {
      return 'valid'
    }

    if (!this.hasComparableSource(article)) {
      return 'unknown'
    }

    const sourceLang = article.meta?.lang || translation.sourceLang || 'unknown'
    const currentHash = this.computeContentHash(
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

    return translation.hash === currentHash ? 'valid' : 'stale'
  }

  private hasComparableSource(article: TranslationSourceSnapshot): boolean {
    return (
      typeof article.text === 'string' || typeof article.content === 'string'
    )
  }

  private isTranslatableDocument(
    document: unknown,
  ): document is ArticleDocument {
    if (!document || typeof document !== 'object') return false
    const value = document as Record<string, unknown>
    return typeof value.title === 'string' && typeof value.text === 'string'
  }
}
