import { Injectable } from '@nestjs/common'
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
}

@Injectable()
export class TranslationEnhancerService {
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

    if (!normalizedTarget) {
      return { ...originalData, isTranslated: false }
    }

    try {
      const translation =
        await this.aiTranslationService.getTranslationForArticle(
          articleId,
          normalizedTarget,
          allowHidden ? { ignoreVisibility: true } : undefined,
        )

      if (!translation) {
        return { ...originalData, isTranslated: false }
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
      }
    } catch {
      return { ...originalData, isTranslated: false }
    }
  }
}
