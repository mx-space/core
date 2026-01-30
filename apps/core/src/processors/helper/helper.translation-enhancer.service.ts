import { Injectable, Logger } from '@nestjs/common'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { normalizeLanguageCode } from '~/utils/lang.util'

export interface TranslationMeta {
  sourceLang: string
  targetLang: string
  translatedAt: Date
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

export interface ArticleTranslationInput {
  id: string
  title: string
  text: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
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
        },
        availableTranslations,
      }
    } catch (error) {
      this.logger.error(error)
      return { ...originalData, isTranslated: false, availableTranslations }
    }
  }

  async enhanceListWithTranslation(options: {
    articles: ArticleTranslationInput[]
    targetLang?: string
  }): Promise<Map<string, TranslationEnhanceResult>> {
    const { articles, targetLang } = options
    const normalizedTarget = normalizeLanguageCode(targetLang)

    if (!normalizedTarget || !articles.length) {
      return new Map(
        articles.map((article) => [
          article.id,
          {
            title: article.title,
            text: article.text,
            summary: article.summary,
            tags: article.tags,
            isTranslated: false,
          },
        ]),
      )
    }

    try {
      const translationMap =
        await this.aiTranslationService.getValidTranslationsForArticles(
          articles,
          normalizedTarget,
        )

      return new Map(
        articles.map((article): [string, TranslationEnhanceResult] => {
          const translation = translationMap.get(article.id)
          if (!translation) {
            return [
              article.id,
              {
                title: article.title,
                text: article.text,
                summary: article.summary,
                tags: article.tags,
                isTranslated: false,
              },
            ]
          }

          return [
            article.id,
            {
              title: translation.title,
              text: translation.text,
              summary: translation.summary ?? article.summary,
              tags: translation.tags ?? article.tags,
              isTranslated: true,
              translationMeta: {
                sourceLang: translation.sourceLang,
                targetLang: translation.lang,
                translatedAt: translation.created!,
              },
            },
          ]
        }),
      )
    } catch (error) {
      this.logger.error(error)
      return new Map(
        articles.map((article) => [
          article.id,
          {
            title: article.title,
            text: article.text,
            summary: article.summary,
            tags: article.tags,
            isTranslated: false,
          },
        ]),
      )
    }
  }
}
