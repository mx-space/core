import { normalizeLanguageCode } from '~/utils/lang.util'
import { z } from 'zod'

export const zBooleanOrString = z.union([z.boolean(), z.string()])

export const zTransformEmptyNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (String(val).length === 0 ? null : val),
    schema.nullable().optional(),
  )

export const zTransformBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val
  if (val === 'true' || val === '1' || val === 1) return true
  if (val === 'false' || val === '0' || val === 0) return false
  return undefined
}, z.boolean().optional())

export const zPinDate = z.preprocess((val) => {
  if (val === null || val === undefined) return val
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    const date = new Date(val)
    if (!Number.isNaN(date.getTime())) return date
  }
  if (val === true) return new Date()
  if (val === false) return null
  return val
}, z.date().nullable().optional())

export const zSlug = z
  .string()
  .min(1)
  .transform((val) => val.trim())

export const zEmail = (message = '请更正为正确的邮箱') =>
  z.string().email({ message })

export const zUrl = (message = '请更正为正确的网址') =>
  z.string().url({ message })

export const zMaxLengthString = (max: number, message?: string) =>
  z.string().max(max, message || `不得大于 ${max} 个字符`)

export const zRefTypeTransform = z.preprocess((val) => {
  if (!val || typeof val !== 'string') return val
  const mapping: Record<string, string> = {
    post: 'Post',
    note: 'Note',
    page: 'Page',
    recently: 'Recently',
  }
  return mapping[val.toLowerCase()] || val
}, z.string().optional())

export const zLang = z
  .preprocess(
    (val) =>
      typeof val === 'string' && val.toLowerCase() === 'original'
        ? undefined
        : normalizeLanguageCode(val as string),
    z.string().length(2).optional(),
  )
  .optional()
