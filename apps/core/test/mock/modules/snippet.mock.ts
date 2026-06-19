import { defineProvider } from 'test/helper/defineProvider'

import { SnippetService } from '~/modules/snippet/snippet.service'

export const snippetProvider = defineProvider({
  provide: SnippetService,
  useValue: {
    async findSkillBundlesByIds() {
      return []
    },
  },
})
