import { isNil } from 'es-toolkit/compat'
import { createZodDto } from 'nestjs-zod'
import qs from 'qs'
import { z } from 'zod'

import { BasicPagerSchema } from '~/shared/dto/pager.dto'
import { BaseSchema } from '~/shared/schema'

export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
  Skill = 'skill',
}

const SnippetPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .transform((val) => val.replaceAll(/^\/+|\/+$/g, ''))
  .refine((val) => val.length > 0, {
    message: 'path is required',
  })
  .refine((val) => !val.includes('//'), {
    message: 'path must not contain empty segments',
  })
  .refine(
    (val) =>
      val.split('/').every((segment) => {
        if (!segment || segment === '.' || segment === '..') return false
        if (Buffer.byteLength(segment, 'utf8') > 255) return false
        // eslint-disable-next-line no-control-regex
        return !/[\u0000-\u001F\u007F]/.test(segment)
      }),
    {
      message: 'path contains an invalid segment',
    },
  )

export const SnippetSchema = BaseSchema.extend({
  type: z.enum(SnippetType).default(SnippetType.JSON),
  private: z.boolean().default(false).optional(),
  raw: z.string(),
  path: SnippetPathSchema,
  comment: z.string().nullable().optional(),
  metatype: z.string().max(20).nullable().optional(),
  schema: z.string().nullable().optional(),
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'])
    .nullable()
    .default('GET')
    .optional(),
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

export const SnippetListSchema = BasicPagerSchema.extend({
  prefix: z.string().default('').optional(),
  recursive: z.coerce.boolean().default(false).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200).optional(),
  type: z.enum(SnippetType).optional(),
})

export class SnippetListDto extends createZodDto(SnippetListSchema) {}

// Type exports
export type SnippetInput = z.infer<typeof SnippetSchema>
export type PartialSnippetInput = z.infer<typeof PartialSnippetSchema>
export type SnippetMoreInput = z.infer<typeof SnippetMoreSchema>
export type SnippetListInput = z.infer<typeof SnippetListSchema>

export const SnippetByPathSchema = z.object({
  path: SnippetPathSchema,
  recursive: z.coerce.boolean().default(false).optional(),
})

export class SnippetByPathDto extends createZodDto(SnippetByPathSchema) {}

export const SnippetMoveSchema = z.object({
  from: SnippetPathSchema,
  to: SnippetPathSchema,
  recursive: z.boolean().default(false).optional(),
})

export class SnippetMoveDto extends createZodDto(SnippetMoveSchema) {}
