import { defineProvider } from 'test/helper/defineProvider'

import { TextMacroService } from '~/processors/helper/helper.macro.service'

export const textMacroProvider = defineProvider({
  provide: TextMacroService,
  useValue: {
    async replaceTextMacro(text) {
      return text
    },
  },
})
