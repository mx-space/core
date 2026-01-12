/**
 * Zod validation utilities
 *
 * This module provides Zod-based validation infrastructure
 * to replace class-validator decorators
 */

// Re-export zod for convenience
export { z } from 'zod'
export { createZodDto } from 'nestjs-zod'

// Primitive types
export {
  zAllowedUrl,
  zArrayUnique,
  zCoerceBoolean,
  zCoerceDate,
  zCoerceInt,
  zCoercePositiveInt,
  zEmptyStringToNull,
  zHexColor,
  zHttpsUrl,
  zMongoId,
  zMongoIdOrInt,
  zNilOrString,
  zNonEmptyString,
  zOptionalBoolean,
  zOptionalDate,
  zPaginationPage,
  zPaginationSize,
  zSortOrder,
  zStrictUrl,
  zUniqueStringArray,
} from './primitives'

// Custom validators (migrated from class-validator)
export {
  zBooleanOrString,
  zEmail,
  zMaxLengthString,
  zPinDate,
  zRefTypeTransform,
  zSlug,
  zTransformBoolean,
  zTransformEmptyNull,
  zUrl,
} from './custom'

// Validation pipe
export {
  ExtendedZodValidationPipe,
  extendedZodValidationPipeInstance,
} from './validation.pipe'
