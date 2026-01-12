import { zAllowedUrl } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Page proxy debug schema
 */
export const PageProxyDebugSchema = z.object({
  __debug: z
    .preprocess((val) => (val === 'false' ? false : true), z.literal(false))
    .optional(),
  __apiUrl: zAllowedUrl.optional(),
  __gatewayUrl: zAllowedUrl.optional(),
  __onlyGithub: z
    .preprocess((val) => {
      return ['', 'true', true].includes(val as any) ? true : false
    }, z.boolean())
    .default(false)
    .optional(),
  __version: z
    .preprocess(
      (val) => (val === 'latest' ? null : val),
      z
        .string()
        .regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/)
        .nullable(),
    )
    .optional(),
  __purge: z
    .preprocess((val) => val === 'true', z.boolean())
    .default(false)
    .optional(),
  __local: z.boolean().default(false).optional(),
})

export class PageProxyDebugDto extends createZodDto(PageProxyDebugSchema) {}

// Type exports
export type PageProxyDebugInput = z.infer<typeof PageProxyDebugSchema>
