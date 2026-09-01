import { z } from 'zod'

import { zSlug } from '~/common/zod'

export const TopicSlugParamsSchema = z.object({
  slug: z.preprocess((val) => {
    if (typeof val === 'string') {
      return decodeURI(val)
    }
    return val
  }, zSlug),
})

export type TopicSlugParamsDto = z.infer<typeof TopicSlugParamsSchema>
