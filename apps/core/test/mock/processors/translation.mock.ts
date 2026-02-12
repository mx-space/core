import { TranslationService } from '~/processors/helper/helper.translation.service'
import { defineProvider } from 'test/helper/defineProvider'

export const translationProvider = defineProvider({
  provide: TranslationService,
  useValue: {
    async translateArticle(options) {
      return {
        ...options.originalData,
        isTranslated: false,
      }
    },
    async translateList(options) {
      const { items, applyResult } = options
      return items.map((item) => applyResult(item, undefined))
    },
  },
})
