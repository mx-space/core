import { defineProvider } from 'test/helper/defineProvider'

import type { CoAuthor } from '~/modules/draft/collab.repository'
import { CollabRepository } from '~/modules/draft/collab.repository'

export const collabCoAuthors = new Map<string, CoAuthor[]>()

export const collabRepositoryProvider = defineProvider({
  provide: CollabRepository,
  useValue: {
    async coAuthorsByRef(_refType: string, refIds: string[]) {
      return new Map(
        refIds
          .filter((id) => collabCoAuthors.has(String(id)))
          .map((id) => [String(id), collabCoAuthors.get(String(id))!]),
      )
    },
  },
})
