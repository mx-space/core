import { z } from 'zod'

/**
 * Custom Zod validators migrated from class-validator decorators
 */

// ==================== IsNilOrString ====================
/**
 * Migrated from: decorators/dto/isNilOrString.ts
 * Validates that value is null, undefined, or a string
 */
export const zNilOrString = z.string().nullable().optional()

// ==================== IsBooleanOrString ====================
/**
 * Migrated from: decorators/dto/isBooleanOrString.ts
 * Validates that value is a boolean or a string
 */
export const zBooleanOrString = z.union([z.boolean(), z.string()])

// ==================== IsMongoIdOrInt ====================
/**
 * Migrated from: decorators/dto/isMongoIdOrInt.ts
 * Validates that value is a MongoId or an integer
 */
export const zMongoIdOrInt = z.union([
  z.string().regex(/^[0-9a-f]{24}$/i, '类型必须为 MongoId or Int'),
  z.coerce.number().int(),
])

// ==================== IsAllowedUrl ====================
/**
 * Migrated from: decorators/dto/isAllowedUrl.ts
 * URL validation that allows localhost and IPs (no TLD required)
 */
export const zAllowedUrl = z.string().refine(
  (val) => {
    if (!val) return true
    try {
      const url = new URL(val)
      return ['http:', 'https:'].includes(url.protocol)
    } catch {
      return false
    }
  },
  { message: '请更正为正确的网址' },
)

// ==================== TransformEmptyNull ====================
/**
 * Migrated from: decorators/dto/transformEmptyNull.ts
 * Transforms empty string to null and makes field optional
 *
 * Usage:
 * const schema = z.object({
 *   field: zTransformEmptyNull(z.string())
 * })
 */
export const zTransformEmptyNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (String(val).length === 0 ? null : val),
    schema.nullable().optional(),
  )

// ==================== TransformBoolean ====================
/**
 * Migrated from: common/decorators/transform-boolean.decorator.ts
 * Transforms various truthy values to boolean
 */
export const zTransformBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val
  if (val === 'true' || val === '1' || val === 1) return true
  if (val === 'false' || val === '0' || val === 0) return false
  return undefined
}, z.boolean().optional())

// ==================== Pin Date Transform ====================
/**
 * Special transform for pin field in post/note
 * Accepts: Date, ISO string, boolean (true = new Date(), false = null)
 */
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

// ==================== Slug Transform ====================
/**
 * Validates and transforms slug (URL-friendly string)
 */
export const zSlug = z
  .string()
  .min(1)
  .transform((val) => val.trim())

// ==================== Email with custom message ====================
/**
 * Email validation with Chinese error message
 */
export const zEmail = (message = '请更正为正确的邮箱') =>
  z.string().email({ message })

// ==================== URL with custom message ====================
/**
 * URL validation with Chinese error message
 */
export const zUrl = (message = '请更正为正确的网址') =>
  z.string().url({ message })

// ==================== MaxLength helper ====================
/**
 * String with max length and custom message
 */
export const zMaxLengthString = (max: number, message?: string) =>
  z.string().max(max, message || `不得大于 ${max} 个字符`)

// ==================== Array Unique helper ====================
/**
 * Array with unique elements
 */
export const zArrayUnique = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).refine((arr) => new Set(arr).size === arr.length, {
    message: '数组元素必须唯一',
  })

// ==================== Ref Type Transform ====================
/**
 * Transform for CollectionRefTypes
 * Normalizes 'post' -> 'Post', 'note' -> 'Note', etc.
 */
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
