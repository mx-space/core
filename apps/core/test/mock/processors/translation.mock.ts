import { defineProvider } from 'test/helper/defineProvider'

import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'

export const translationProvider = defineProvider({
  provide: TranslationService,
  useValue: {
    async translateArticle(options) {
      return {
        ...options.originalData,
        isTranslated: false,
      }
    },
    async getCachedTitles() {
      return new Map()
    },
    async translateList(options) {
      const { items, applyResult } = options
      return items.map((item) => applyResult(item, undefined))
    },
    async translateArticleList() {
      return new Map()
    },
    async collectArticleTranslations() {
      return {
        results: new Map(),
        meta: new Map(),
      }
    },
  },
})

export const translationEntryProvider = {
  provide: TranslationEntryService,
  useValue: {
    async getTranslationsBatch() {
      return {
        entityMaps: new Map<string, Map<string, string>>(),
        dictMaps: new Map<string, Map<string, string>>(),
      }
    },
  },
}
