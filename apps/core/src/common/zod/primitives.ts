import { z } from 'zod'

// ==================== MongoDB Types ====================

/**
 * MongoDB ObjectId validation
 */
export const zMongoId = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Invalid MongoDB ObjectId')

/**
 * MongoDB ObjectId or integer (for nid fields)
 */
export const zMongoIdOrInt = z.union([
  zMongoId,
  z.coerce.number().int().positive(),
])

// ==================== String Types ====================

/**
 * Non-empty string
 */
export const zNonEmptyString = z.string().min(1)

/**
 * Nullable string (empty string converts to null)
 */
export const zEmptyStringToNull = z.preprocess(
  (val) => (val === '' ? null : val),
  z.string().nullable(),
)

/**
 * Optional string that can be null or undefined
 */
export const zNilOrString = z.string().nullable().optional()

/**
 * Hex color validation (#RRGGBB or #RGB)
 */
export const zHexColor = z
  .string()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Invalid hex color')

// ==================== URL Types ====================

/**
 * URL that allows localhost and IP addresses (no TLD required)
 */
export const zAllowedUrl = z.string().refine(
  (val) => {
    try {
      const url = new URL(val)
      return ['http:', 'https:'].includes(url.protocol)
    } catch {
      return false
    }
  },
  { message: '请更正为正确的网址' },
)

/**
 * Strict URL with protocol required
 */
export const zStrictUrl = z.string().url()

/**
 * HTTPS URL only
 */
export const zHttpsUrl = z
  .string()
  .url()
  .refine((val) => val.startsWith('https://'), {
    message: 'URL must use HTTPS protocol',
  })

// ==================== Number Types ====================

/**
 * Coerce string to integer
 */
export const zCoerceInt = z.coerce.number().int()

/**
 * Coerce string to positive integer
 */
export const zCoercePositiveInt = z.coerce.number().int().positive()

/**
 * Pagination size (1-50, default 10)
 */
export const zPaginationSize = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(20)

/**
 * Pagination page (min 1, default 1)
 */
export const zPaginationPage = z.coerce.number().int().min(1).default(1)

// ==================== Boolean Types ====================

/**
 * Coerce various values to boolean
 * Accepts: true, false, 'true', 'false', '1', '0', 1, 0
 */
export const zCoerceBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val
  if (val === 'true' || val === '1' || val === 1) return true
  if (val === 'false' || val === '0' || val === 0) return false
  return val
}, z.boolean())

/**
 * Optional coerced boolean
 */
export const zOptionalBoolean = zCoerceBoolean.optional()

// ==================== Date Types ====================

/**
 * Coerce string/number to Date
 */
export const zCoerceDate = z.coerce.date()

/**
 * Optional date that handles null and undefined
 */
export const zOptionalDate = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined
  return val
}, z.coerce.date().optional())

// ==================== Array Types ====================

/**
 * Array with unique elements validation
 */
export const zArrayUnique = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).refine((arr) => new Set(arr).size === arr.length, {
    message: 'Array elements must be unique',
  })

/**
 * Non-empty string array with unique elements
 */
export const zUniqueStringArray = zArrayUnique(z.string().min(1))

// ==================== Sort Types ====================

/**
 * Sort order (1 for asc, -1 for desc)
 */
export const zSortOrder = z.preprocess(
  (val) => {
    if (typeof val === 'number' && (val === 1 || val === -1)) return val
    if (typeof val === 'string') {
      if (val === '1' || val === 'asc') return 1
      if (val === '-1' || val === 'desc') return -1
      const num = Number.parseInt(val)
      if (num === 1 || num === -1) return num
    }
    return undefined
  },
  z.union([z.literal(1), z.literal(-1)]).optional(),
)
