import { z } from 'zod'

// MongoDB Types

export const zMongoId = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Invalid MongoDB ObjectId')

export const zMongoIdOrInt = z.union([
  zMongoId,
  z.coerce.number().int().positive(),
])

// String Types

export const zNonEmptyString = z.string().min(1)

export const zEmptyStringToNull = z.preprocess(
  (val) => (val === '' ? null : val),
  z.string().nullable(),
)

export const zNilOrString = z.string().nullable().optional()

export const zHexColor = z
  .string()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Invalid hex color')

// URL Types

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

export const zStrictUrl = z.string().url()

export const zHttpsUrl = z
  .string()
  .url()
  .refine((val) => val.startsWith('https://'), {
    message: 'URL must use HTTPS protocol',
  })

// Number Types

export const zCoerceInt = z.coerce.number().int()

export const zCoercePositiveInt = z.coerce.number().int().positive()

export const zPaginationSize = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .default(20)

export const zPaginationPage = z.coerce.number().int().min(1).default(1)

// Boolean Types

export const zCoerceBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val
  if (val === 'true' || val === '1' || val === 1) return true
  if (val === 'false' || val === '0' || val === 0) return false
  return val
}, z.boolean())

export const zOptionalBoolean = zCoerceBoolean.optional()

// Date Types

export const zCoerceDate = z.coerce.date()

export const zOptionalDate = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined
  return val
}, z.coerce.date().optional())

// Array Types

export const zArrayUnique = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).refine((arr) => new Set(arr).size === arr.length, {
    message: 'Array elements must be unique',
  })

export const zUniqueStringArray = zArrayUnique(z.string().min(1))

// Sort Types

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
