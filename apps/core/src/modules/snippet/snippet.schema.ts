import { BaseSchema } from '~/shared/schema'
import { isNil } from 'es-toolkit/compat'
import { createZodDto } from 'nestjs-zod'
import qs from 'qs'
import { z } from 'zod'

export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}

/**
 * Snippet schema for API validation
 */
export const SnippetSchema = BaseSchema.extend({
  type: z.enum(SnippetType).default(SnippetType.JSON),
  private: z.boolean().default(false).optional(),
  raw: z
    .string()
    .min(1)
    .transform((val) => val.trim()),
  name: z.string().regex(/^[\w-]{1,30}$/, {
    message: 'name 只能使用英文字母和数字下划线且不超过 30 个字符',
  }),
  reference: z.string().min(1).default('root').optional(),
  comment: z.string().optional(),
  metatype: z.string().max(20).optional(),
  schema: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).optional(),

  /**
   * For `Function` snippet only.
   * - Request payload might send `secret` as an object (e.g. `{ foo: "bar" }`)
   * - DB stores it as a qs string (e.g. `foo=bar`)
   */
  secret: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .optional()
    .transform((val) => {
      if (isNil(val)) return val
      if (typeof val === 'string') return val
      return qs.stringify(val)
    }),
  enable: z.boolean().optional(),
})

export class SnippetDto extends createZodDto(SnippetSchema) {}

/**
 * Partial snippet schema for PATCH operations
 */
export const PartialSnippetSchema = SnippetSchema.partial()

export class PartialSnippetDto extends createZodDto(PartialSnippetSchema) {}

/**
 * Snippet more schema for batch import
 */
export const SnippetMoreSchema = z.object({
  snippets: z.array(SnippetSchema),
  packages: z.array(z.string()).optional(),
})

export class SnippetMoreDto extends createZodDto(SnippetMoreSchema) {}

// Type exports
export type SnippetInput = z.infer<typeof SnippetSchema>
export type PartialSnippetInput = z.infer<typeof PartialSnippetSchema>
export type SnippetMoreInput = z.infer<typeof SnippetMoreSchema>
