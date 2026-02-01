import { Injectable, Logger } from '@nestjs/common'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { normalizeLanguageCode } from '~/utils/lang.util'

export interface TranslationMeta {
  sourceLang: string
  targetLang: string
  translatedAt: Date
  model?: string
}

export interface TranslationEnhanceResult {
  title: string
  text: string
  summary?: string | null
  tags?: string[]
  isTranslated: boolean
  translationMeta?: TranslationMeta
  availableTranslations?: string[]
}

export type TranslationEnhanceField = keyof TranslationEnhanceResult
export type TranslationEnhanceResultPick<
  Fields extends TranslationEnhanceField = TranslationEnhanceField,
> = { isTranslated: boolean } & Pick<TranslationEnhanceResult, Fields>

export interface ArticleTranslationInput {
  id: string
  title: string
  text?: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  modified?: Date | null
  created?: Date | null
}

@Injectable()
export class TranslationEnhancerService {
  private readonly logger = new Logger(TranslationEnhancerService.name)
  constructor(private readonly aiTranslationService: AiTranslationService) {}

  async enhanceWithTranslation(options: {
    articleId: string
    targetLang?: string
    allowHidden?: boolean
    originalData: {
      title: string
      text: string
      summary?: string | null
      tags?: string[]
    }
  }): Promise<TranslationEnhanceResult> {
    const { articleId, targetLang, allowHidden, originalData } = options
    const normalizedTarget = normalizeLanguageCode(targetLang)

    // 获取可用翻译列表
    const availableTranslations =
      await this.aiTranslationService.getAvailableLanguagesForArticle(articleId)

    if (!normalizedTarget) {
      return { ...originalData, isTranslated: false, availableTranslations }
    }

    try {
      const translation =
        await this.aiTranslationService.getTranslationForArticle(
          articleId,
          normalizedTarget,
          allowHidden ? { ignoreVisibility: true } : undefined,
        )

      if (!translation) {
        return { ...originalData, isTranslated: false, availableTranslations }
      }

      return {
        title: translation.title,
        text: translation.text,
        summary: translation.summary ?? originalData.summary,
        tags: translation.tags ?? originalData.tags,
        isTranslated: true,
        translationMeta: {
          sourceLang: translation.sourceLang,
          targetLang: translation.lang,
          translatedAt: translation.created!,
          model: translation.aiModel,
        },
        availableTranslations,
      }
    } catch (error) {
      this.logger.error(error)
      return { ...originalData, isTranslated: false, availableTranslations }
    }
  }

  /**
   * 通用列表翻译方法
   *
   * @warning items 数组在方法执行期间不应被修改或重排，
   *          因为内部使用 index 匹配 inputs 和结果
   */
  async translateList<
    T,
    Fields extends TranslationEnhanceField = TranslationEnhanceField,
  >(options: {
    items: T[]
    targetLang?: string
    translationFields?: readonly Fields[]
    getInput: (item: T) => ArticleTranslationInput
    applyResult: (
      item: T,
      result: TranslationEnhanceResultPick<Fields> | undefined,
    ) => T
  }): Promise<T[]> {
    const { items, targetLang, getInput, applyResult, translationFields } =
      options
    const normalizedTarget = normalizeLanguageCode(targetLang)

    // 无 lang 或空列表时，直接返回，避免不必要的 getInput 调用
    if (!normalizedTarget || !items.length) {
      return items.map((item) => applyResult(item, undefined))
    }

    // 仅在需要翻译时才计算 inputs（避免无 lang 时的无效计算）
    const inputs = items.map(getInput)

    const translationResults = await this.enhanceListWithTranslation({
      articles: inputs,
      targetLang: normalizedTarget,
      translationFields,
    })

    return items.map((item, index) => {
      const input = inputs[index] // 使用预计算的 input（通过 index 匹配）
      const translation = translationResults.get(input.id)
      return applyResult(item, translation)
    })
  }

  private pickTranslationFields<Fields extends TranslationEnhanceField>(
    result: TranslationEnhanceResult,
    fields: readonly Fields[],
  ): TranslationEnhanceResultPick<Fields> {
    const picked = { isTranslated: result.isTranslated } as Record<
      string,
      unknown
    >

    for (const field of fields) {
      picked[field] = result[field]
    }

    return picked as TranslationEnhanceResultPick<Fields>
  }

  private buildTranslationSelect(
    fields: readonly TranslationEnhanceField[],
  ): string {
    const selectFields = new Set([
      'refId',
      'hash',
      'sourceLang',
      'sourceModified',
    ])

    if (fields.includes('title')) selectFields.add('title')
    if (fields.includes('text')) selectFields.add('text')
    if (fields.includes('summary')) selectFields.add('summary')
    if (fields.includes('tags')) selectFields.add('tags')
    if (fields.includes('translationMeta')) {
      selectFields.add('lang')
      selectFields.add('created')
      selectFields.add('aiModel')
    }

    return [...selectFields].join(' ')
  }

  async enhanceListWithTranslation<
    Fields extends TranslationEnhanceField = TranslationEnhanceField,
  >(options: {
    articles: ArticleTranslationInput[]
    targetLang?: string
    translationFields?: readonly Fields[]
  }): Promise<Map<string, TranslationEnhanceResultPick<Fields>>> {
    const { articles, targetLang } = options
    const defaultFields: readonly TranslationEnhanceField[] = [
      'title',
      'text',
      'summary',
      'tags',
      'translationMeta',
      'availableTranslations',
    ]
    const translationFields = (options.translationFields ??
      defaultFields) as readonly Fields[]
    const translationFieldList =
      translationFields as readonly TranslationEnhanceField[]
    const normalizedTarget = normalizeLanguageCode(targetLang)

    if (!normalizedTarget || !articles.length) {
      return new Map(
        articles.map((article) => [
          article.id,
          this.pickTranslationFields(
            {
              title: article.title,
              text: article.text ?? '',
              summary: article.summary,
              tags: article.tags,
              isTranslated: false,
            },
            translationFields,
          ),
        ]),
      )
    }

    try {
      const translationMap =
        await this.aiTranslationService.getValidTranslationsForArticles(
          articles,
          normalizedTarget,
          { select: this.buildTranslationSelect(translationFieldList) },
        )

      return new Map(
        articles.map(
          (article): [string, TranslationEnhanceResultPick<Fields>] => {
            const translation = translationMap.get(article.id)
            if (!translation) {
              return [
                article.id,
                this.pickTranslationFields(
                  {
                    title: article.title,
                    text: article.text ?? '',
                    summary: article.summary,
                    tags: article.tags,
                    isTranslated: false,
                  },
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
                  summary: translation.summary ?? article.summary,
                  tags: translation.tags ?? article.tags,
                  isTranslated: true,
                  translationMeta: translationFieldList.includes(
                    'translationMeta',
                  )
                    ? {
                        sourceLang: translation.sourceLang,
                        targetLang: translation.lang,
                        translatedAt: translation.created!,
                        model: translation.aiModel,
                      }
                    : undefined,
                },
                translationFields,
              ),
            ]
          },
        ),
      )
    } catch (error) {
      this.logger.error(error)
      return new Map(
        articles.map((article) => [
          article.id,
          this.pickTranslationFields(
            {
              title: article.title,
              text: article.text ?? '',
              summary: article.summary,
              tags: article.tags,
              isTranslated: false,
            },
            translationFields,
          ),
        ]),
      )
    }
  }
}
