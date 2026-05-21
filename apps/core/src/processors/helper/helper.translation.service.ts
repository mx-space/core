import { Injectable, Logger } from '@nestjs/common'

import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import type { TranslationSourceSnapshot } from '~/modules/ai/ai-translation/translation-consistency.types'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import type { TranslationEntryKeyPath } from '~/modules/ai/ai-translation/translation-entry.types'
import { normalizeLanguageCode } from '~/utils/lang.util'

export interface TranslationMeta {
  sourceLang: string
  targetLang: string
  translatedAt: Date
  model?: string
}

export interface TranslationResult {
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  content?: string
  contentFormat?: string
  isTranslated: boolean
  sourceLang?: string
  translationMeta?: TranslationMeta
  availableTranslations?: string[]
}

export type TranslationField = keyof TranslationResult
export type TranslationResultPick<
  Fields extends TranslationField = TranslationField,
> = { isTranslated: boolean } & Pick<TranslationResult, Fields>
export type ArticleTranslationInput = TranslationSourceSnapshot

/**
 * Build the `translation.article` meta payload (camelCase) for a detail
 * response. Always emits `isTranslated`, `sourceLang`, and
 * `availableTranslations` so consumers can read them unconditionally.
 * When the article has actually been translated, the translated fields
 * (title/text/content/...) plus any `extras` (e.g. `summary`/`tags` for
 * posts, `subtitle` for pages) are merged in. Wire-layer snake_case
 * conversion is handled by `ResponseInterceptorV2`.
 */
export function buildArticleTranslationMeta(
  result: TranslationResult,
  lang: string | undefined,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    isTranslated: result.isTranslated,
    sourceLang: result.sourceLang ?? null,
    availableTranslations: result.availableTranslations ?? [],
  }
  if (result.isTranslated) {
    Object.assign(meta, {
      targetLang: lang,
      title: result.title,
      text: result.text,
      content: result.content,
      contentFormat: result.contentFormat,
      ...extras,
    })
  }
  return meta
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name)
  constructor(
    private readonly aiTranslationService: AiTranslationService,
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  async getCachedTitles(
    refIds: string[],
    lang?: string,
  ): Promise<Map<string, string>> {
    if (!lang || !refIds.length) return new Map()
    const normalized = normalizeLanguageCode(lang)
    if (!normalized) return new Map()
    return this.aiTranslationService.findCachedTitlesByRefIds(
      refIds,
      normalized,
    )
  }

  async translateArticle(options: {
    articleId: string
    targetLang?: string
    allowHidden?: boolean
    originalData: {
      title: string
      text: string
      subtitle?: string | null
      summary?: string | null
      tags?: string[]
    }
  }): Promise<TranslationResult> {
    const { articleId, targetLang, allowHidden, originalData } = options
    const normalizedTarget = normalizeLanguageCode(targetLang)

    try {
      const { availableTranslations, sourceLang, translation } =
        await this.aiTranslationService.getTranslationAndAvailableLanguages(
          articleId,
          normalizedTarget || undefined,
          allowHidden ? { ignoreVisibility: true } : undefined,
        )

      if (!normalizedTarget || !translation) {
        return {
          ...originalData,
          isTranslated: false,
          sourceLang: sourceLang ?? undefined,
          availableTranslations,
        }
      }

      const result: TranslationResult = {
        title: translation.title,
        text: translation.text,
        subtitle: translation.subtitle ?? originalData.subtitle,
        summary: translation.summary ?? originalData.summary,
        tags: translation.tags ?? originalData.tags,
        isTranslated: true,
        sourceLang: translation.sourceLang,
        translationMeta: {
          sourceLang: translation.sourceLang,
          targetLang: translation.lang,
          translatedAt: translation.createdAt,
          model: translation.aiModel ?? undefined,
        },
        availableTranslations,
      }
      if (translation.content) result.content = translation.content
      if (translation.contentFormat)
        result.contentFormat = translation.contentFormat
      return result
    } catch (error) {
      this.logger.error(error)
      return { ...originalData, isTranslated: false }
    }
  }

  /**
   * Generic list translation method.
   *
   * @warning The items array must not be mutated or reordered while this
   *          method is running, because indexes are used to match inputs
   *          with results.
   */
  async translateList<
    T,
    Fields extends TranslationField = TranslationField,
  >(options: {
    items: T[]
    targetLang?: string
    translationFields?: readonly Fields[]
    getInput: (item: T) => TranslationSourceSnapshot
    applyResult: (
      item: T,
      result: TranslationResultPick<Fields> | undefined,
    ) => T
  }): Promise<T[]> {
    const { items, targetLang, getInput, applyResult, translationFields } =
      options
    const normalizedTarget = normalizeLanguageCode(targetLang)

    if (!normalizedTarget || !items.length) {
      return items.map((item) => applyResult(item, undefined))
    }

    const inputs = items.map(getInput)

    const translationResults = await this.translateArticleList({
      articles: inputs,
      targetLang: normalizedTarget,
      translationFields,
    })

    return items.map((item, index) => {
      const input = inputs[index]
      const translation = translationResults.get(input.id)
      return applyResult(item, translation)
    })
  }

  private pickTranslationFields<Fields extends TranslationField>(
    result: TranslationResult,
    fields: readonly Fields[],
  ): TranslationResultPick<Fields> {
    const picked = { isTranslated: result.isTranslated } as Record<
      string,
      unknown
    >

    for (const field of fields) {
      picked[field] = result[field]
    }

    return picked as TranslationResultPick<Fields>
  }

  private buildUntranslatedResult(
    article: TranslationSourceSnapshot,
  ): TranslationResult {
    return {
      title: article.title,
      text: article.text ?? '',
      subtitle: article.subtitle,
      summary: article.summary,
      tags: article.tags,
      isTranslated: false,
    }
  }

  private static readonly TRANSLATION_SELECT_BASE = [
    'refId',
    'hash',
    'sourceLang',
    'sourceModifiedAt',
  ]

  private static readonly TRANSLATION_SELECT_BY_FIELD: Partial<
    Record<TranslationField, readonly string[]>
  > = {
    title: ['title'],
    text: ['text'],
    subtitle: ['subtitle'],
    summary: ['summary'],
    tags: ['tags'],
    content: ['content', 'contentFormat'],
    translationMeta: ['lang', 'created', 'aiModel'],
  }

  private buildTranslationSelect(fields: readonly TranslationField[]): string {
    const selectFields = new Set(TranslationService.TRANSLATION_SELECT_BASE)
    for (const field of fields) {
      const extra = TranslationService.TRANSLATION_SELECT_BY_FIELD[field]
      if (extra) extra.forEach((f) => selectFields.add(f))
    }
    return [...selectFields].join(' ')
  }

  async translateArticleList<
    Fields extends TranslationField = TranslationField,
  >(options: {
    articles: TranslationSourceSnapshot[]
    targetLang?: string
    translationFields?: readonly Fields[]
  }): Promise<Map<string, TranslationResultPick<Fields>>> {
    const { articles, targetLang } = options
    const defaultFields: readonly TranslationField[] = [
      'title',
      'text',
      'subtitle',
      'summary',
      'tags',
      'content',
      'translationMeta',
    ]
    const translationFields = (options.translationFields ??
      defaultFields) as readonly Fields[]
    const translationFieldList =
      translationFields as readonly TranslationField[]
    const normalizedTarget = normalizeLanguageCode(targetLang)

    const buildUntranslatedMap = () =>
      new Map(
        articles.map((article) => [
          article.id,
          this.pickTranslationFields(
            this.buildUntranslatedResult(article),
            translationFields,
          ),
        ]),
      )

    if (!normalizedTarget || !articles.length) {
      return buildUntranslatedMap()
    }

    try {
      const { validTranslations: translationMap } =
        await this.aiTranslationService.getValidTranslationsForArticles(
          articles,
          normalizedTarget,
          { select: this.buildTranslationSelect(translationFieldList) },
        )

      return new Map(
        articles.map((article): [string, TranslationResultPick<Fields>] => {
          const translation = translationMap.get(article.id)
          if (!translation) {
            return [
              article.id,
              this.pickTranslationFields(
                this.buildUntranslatedResult(article),
                translationFields,
              ),
            ]
          }

          return [
            article.id,
            this.pickTranslationFields(
              {
                title: translation.title,
                text: translation.text,
                subtitle: translation.subtitle ?? article.subtitle,
                summary: translation.summary ?? article.summary,
                tags: translation.tags ?? article.tags,
                content: translation.content ?? undefined,
                contentFormat: translation.contentFormat ?? undefined,
                isTranslated: true,
                translationMeta: translationFieldList.includes(
                  'translationMeta',
                )
                  ? {
                      sourceLang: translation.sourceLang,
                      targetLang: translation.lang,
                      translatedAt: translation.createdAt,
                      model: translation.aiModel ?? undefined,
                    }
                  : undefined,
              },
              translationFields,
            ),
          ]
        }),
      )
    } catch (error) {
      this.logger.error(error)
      return buildUntranslatedMap()
    }
  }

  async getEntityTranslations(
    keyPath: TranslationEntryKeyPath,
    lang: string,
    lookupKeys: string[],
  ): Promise<Map<string, string>> {
    const normalized = normalizeLanguageCode(lang)
    if (!normalized || !lookupKeys.length) return new Map()
    try {
      return await this.translationEntryService.getTranslations(
        keyPath,
        normalized,
        lookupKeys,
      )
    } catch (error) {
      this.logger.error(error)
      return new Map()
    }
  }

  async getTopicTranslationFields(
    lang: string,
    topicIds: string[],
  ): Promise<Map<string, Record<string, string>>> {
    const result = new Map<string, Record<string, string>>()
    if (!topicIds.length) return result

    const [names, introduces, descriptions] = await Promise.all([
      this.getEntityTranslations('topic.name', lang, topicIds),
      this.getEntityTranslations('topic.introduce', lang, topicIds),
      this.getEntityTranslations('topic.description', lang, topicIds),
    ])

    for (const id of topicIds) {
      const fields: Record<string, string> = {}
      const name = names.get(id)
      const introduce = introduces.get(id)
      const description = descriptions.get(id)
      if (name) fields.name = name
      if (introduce) fields.introduce = introduce
      if (description) fields.description = description
      if (Object.keys(fields).length > 0) result.set(id, fields)
    }
    return result
  }

  async getDictTranslations(
    keyPath: TranslationEntryKeyPath,
    lang: string,
    sourceTexts: string[],
  ): Promise<Map<string, string>> {
    const normalized = normalizeLanguageCode(lang)
    if (!normalized || !sourceTexts.length) return new Map()
    try {
      return await this.translationEntryService.getTranslationsForDict(
        keyPath,
        normalized,
        sourceTexts,
      )
    } catch (error) {
      this.logger.error(error)
      return new Map()
    }
  }
}
