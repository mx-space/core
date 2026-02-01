import { TranslationEnhancerService } from '~/processors/helper/helper.translation-enhancer.service'
import { defineProvider } from 'test/helper/defineProvider'

export const translationEnhancerProvider = defineProvider({
  provide: TranslationEnhancerService,
  useValue: {
    async enhanceWithTranslation(options) {
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
