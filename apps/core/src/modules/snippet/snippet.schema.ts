import { isNil } from 'es-toolkit/compat'
import { createZodDto } from 'nestjs-zod'
import qs from 'qs'
import { z } from 'zod'

import { BaseSchema } from '~/shared/schema'

export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}

export const SnippetSchema = BaseSchema.extend({
  type: z.enum(SnippetType).default(SnippetType.JSON),
  private: z.boolean().default(false).optional(),
  raw: z
    .string()
    .min(1)
    .transform((val) => val.trim()),
  name: z.string().regex(/^[\w-]{1,30}$/, {
    message:
      'name must only contain letters, digits, and underscores, and be at most 30 characters',
  }),
  reference: z.string().min(1).default('root').optional(),
  comment: z.string().nullable().optional(),
  metatype: z.string().max(20).nullable().optional(),
  schema: z.string().nullable().optional(),
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'])
    .nullable()
    .default('GET')
    .optional(),
  customPath: z.preprocess(
    (val) => (val === null ? undefined : val),
    z
      .string()
      .regex(/^[\w-](?:[\w/-]*[\w-])?$/)
      .refine((val) => !val.includes('//'), {
        message: 'customPath must not contain consecutive slashes',
      })
      .pipe(z.string().max(200))
      .optional()
      .transform((val) => val?.replaceAll(/^\/+|\/+$/g, '') || undefined),
  ),

  /**
   * For `Function` snippet only.
   * - Request payload might send `secret` as an object (e.g. `{ foo: "bar" }`)
   * - DB stores it as a qs string (e.g. `foo=bar`)
   */
  secret: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .nullable()
    .optional()
    .transform((val) => {
      if (isNil(val)) return val
      if (typeof val === 'string') return val
      return qs.stringify(val)
    }),
  enable: z.boolean().optional(),
})

export class SnippetDto extends createZodDto(SnippetSchema) {}

export const PartialSnippetSchema = SnippetSchema.partial()

export class PartialSnippetDto extends createZodDto(PartialSnippetSchema) {}

export const SnippetMoreSchema = z.object({
  snippets: z.array(SnippetSchema),
  packages: z.array(z.string()).optional(),
})

export class SnippetMoreDto extends createZodDto(SnippetMoreSchema) {}

// Type exports
export type SnippetInput = z.infer<typeof SnippetSchema>
export type PartialSnippetInput = z.infer<typeof PartialSnippetSchema>
export type SnippetMoreInput = z.infer<typeof SnippetMoreSchema>
