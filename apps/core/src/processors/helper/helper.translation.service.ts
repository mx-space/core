import { Injectable, Logger } from '@nestjs/common'

import type { EntryTranslation } from '~/common/response/meta.types'
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

export type ArticleMetaField =
  | 'title'
  | 'text'
  | 'subtitle'
  | 'summary'
  | 'tags'
  | 'content'
  | 'contentFormat'

export type ArticleTranslatableField =
  | 'title'
  | 'text'
  | 'subtitle'
  | 'summary'
  | 'tags'
  | 'content'
  | 'contentFormat'

export type EntryMaps = {
  entityMaps: Map<TranslationEntryKeyPath, Map<string, string>>
  dictMaps: Map<TranslationEntryKeyPath, Map<string, string>>
}

export type EntryRule =
  | { path: string; keyPath: TranslationEntryKeyPath; mode: 'dict' }
  | {
      path: string
      keyPath: TranslationEntryKeyPath
      mode: 'entity'
      idField: string
    }

const ALL_TRANSLATABLE_FIELDS: readonly ArticleTranslatableField[] = [
  'title',
  'text',
  'subtitle',
  'summary',
  'tags',
  'content',
  'contentFormat',
]

export function buildArticleTranslationMeta(
  result: TranslationResult,
  lang: string | undefined,
): Record<string, unknown> {
  return {
    isTranslated: result.isTranslated,
    sourceLang: result.sourceLang ?? null,
    targetLang: result.translationMeta?.targetLang ?? lang ?? null,
    translatedAt: result.translationMeta?.translatedAt,
    model: result.translationMeta?.model,
    availableTranslations: result.availableTranslations ?? [],
  }
}

export function applyArticleTranslationInPlace<T extends Record<string, any>>(
  target: T,
  result: TranslationResult,
  opts?: { fields?: ReadonlyArray<ArticleTranslatableField> },
): T {
  if (!result.isTranslated) return target
  const fields = opts?.fields ?? ALL_TRANSLATABLE_FIELDS

  for (const field of fields) {
    if (field === 'content' || field === 'contentFormat') continue
    const value = (result as unknown as Record<string, unknown>)[field]
    if (value != null) {
      target[field as keyof T] = value as T[keyof T]
    }
  }

  if (fields.includes('content') && result.content != null) {
    target['content' as keyof T] = result.content as T[keyof T]
    if (fields.includes('contentFormat') && result.contentFormat != null) {
      target['contentFormat' as keyof T] = result.contentFormat as T[keyof T]
    }
  }

  return target
}

function getNestedValue(obj: Record<string, any>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] == null || typeof current[part] !== 'object') return
    current = current[part] as Record<string, unknown>
  }
  current[parts.at(-1)!] = value
}

export function applyTranslationEntriesInPlace<T extends Record<string, any>>(
  target: T,
  maps: EntryMaps,
  rules: ReadonlyArray<EntryRule>,
): T {
  for (const rule of rules) {
    if (rule.mode === 'dict') {
      const dictMap = maps.dictMaps.get(rule.keyPath)
      if (!dictMap) continue
      const sourceValue = getNestedValue(target, rule.path)
      if (sourceValue == null || typeof sourceValue !== 'string') continue
      const translated = dictMap.get(sourceValue)
      if (translated != null) {
        setNestedValue(target, rule.path, translated)
      }
    } else {
      const entityMap = maps.entityMaps.get(rule.keyPath)
      if (!entityMap) continue

      const pathParts = rule.path.split('.')
      const parentPath = pathParts.slice(0, -1).join('.')
      const parent = parentPath
        ? getNestedValue(target, parentPath)
        : (target as unknown)

      if (parent == null || typeof parent !== 'object') continue

      const parentObj = parent as Record<string, unknown>
      const id = parentObj[rule.idField]
      if (id == null || typeof id !== 'string') continue

      const translated = entityMap.get(id)
      if (translated != null) {
        setNestedValue(target, rule.path, translated)
      }
    }
  }
  return target
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
                sourceLang: translation.sourceLang,
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

  async collectArticleTranslations(options: {
    articles: TranslationSourceSnapshot[]
    targetLang?: string
    fields: readonly ArticleMetaField[]
  }): Promise<{
    results: Map<string, TranslationResultPick<TranslationField>>
    meta: Map<string, EntryTranslation>
  }> {
    const { articles, targetLang, fields } = options
    const empty = {
      results: new Map<string, TranslationResultPick<TranslationField>>(),
      meta: new Map<string, EntryTranslation>(),
    }
    if (!targetLang || !articles.length) return empty

    const projection = Array.from(
      new Set<TranslationField>([
        ...fields,
        'translationMeta',
        'sourceLang',
        'availableTranslations',
      ]),
    )
    const results = await this.translateArticleList({
      articles,
      targetLang,
      translationFields: projection,
    })

    const meta = new Map<string, EntryTranslation>()
    for (const [id, translation] of results) {
      if (!translation?.isTranslated) continue
      meta.set(id, {
        article: buildArticleTranslationMeta(
          translation as unknown as TranslationResult,
          targetLang,
        ),
      } as EntryTranslation)
    }

    return { results, meta }
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
