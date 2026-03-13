import { createZodDto } from 'nestjs-zod'
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

export class TopicSlugParamsDto extends createZodDto(TopicSlugParamsSchema) {}
