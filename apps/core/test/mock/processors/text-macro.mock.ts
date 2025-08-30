import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { defineProvider } from 'test/helper/defineProvider'

export const textMacroProvider = defineProvider({
  provide: TextMacroService,
  useValue: {
    async replaceTextMacro(text) {
      return text
    },
  },
})
