---
name: zod-patterns
description: MX Space project Zod schema patterns. Apply when creating DTOs, validation schemas, or handling request validation.
user-invocable: false
---

# Zod Schema Patterns

## Basic Pattern

```typescript
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

// Define Schema
export const MySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
})

// Create DTO class
export class MyDto extends createZodDto(MySchema) {}

// Partial DTO for updates
export class PartialMyDto extends createZodDto(MySchema.partial()) {}
```

## Project Custom Validators

Location: `apps/core/src/common/zod/`

```typescript
import {
  // From primitives.ts:
  zNonEmptyString,       // Non-empty string (z.string().min(1))
  zCoerceInt,            // Coerced integer
  zCoercePositiveInt,    // Coerced positive integer
  zCoerceBoolean,        // Coerced boolean (handles 'true'/'1'/1/etc.)
  zCoerceDate,           // Coerced date
  zOptionalDate,         // Optional date (null/empty → undefined)
  zOptionalBoolean,      // Optional coerced boolean
  zEmptyStringToNull,    // Empty string → null, else string
  zNilOrString,          // string | null | undefined
  zHexColor,             // Hex color (#fff or #ffffff)
  zAllowedUrl,           // HTTP or HTTPS URL
  zStrictUrl,            // Strict URL validation
  zHttpsUrl,             // HTTPS-only URL
  zPaginationPage,       // Coerced int, min 1, default 1
  zPaginationSize,       // Coerced int, min 1, max 50, default 20
  zSortOrder,            // 1 | -1 | undefined (accepts 'asc'/'desc')
  zArrayUnique,          // Unique array elements (generic)
  zUniqueStringArray,    // Unique non-empty string array

  // From custom.ts:
  zBooleanOrString,      // boolean | string union
  zTransformEmptyNull,   // Empty string → null (generic wrapper)
  zTransformBoolean,     // Transform to optional boolean
  zPinDate,              // Pin date (Date | null | undefined, true=now, false=null)
  zSlug,                 // Slug string (trimmed)
  zEmail,                // Email with custom message
  zUrl,                  // URL with custom message
  zMaxLengthString,      // Max length string factory
  zRefTypeTransform,     // Content ref type ('post'→'Post', etc.)
  zPrefer,               // 'lexical' enum optional
  zLang,                 // 2-char language code

  // From shared/id/entity-id.ts:
  zEntityId,             // Snowflake entity ID string validation
  zEntityIdOrInt,        // Entity ID or positive integer union
} from '~/common/zod'
```

## Entity ID Validation

```typescript
import { zEntityId } from '~/common/zod'

const Schema = z.object({
  id: zEntityId,                    // Snowflake ID string
  categoryId: zEntityId,            // Foreign key reference
  relatedIds: z.array(zEntityId),   // Array of entity IDs
})

// For DTOs used in path params:
import { EntityIdDto } from '~/shared/dto/id.dto'
// EntityIdDto = { id: zEntityId }
```

## Extending Base Schemas

```typescript
// Compose schemas using .extend()
const PostSchema = z.object({
  title: zNonEmptyString,
  slug: zSlug,
  categoryId: zEntityId,
  tags: z.array(z.string()).optional(),
  contentFormat: z.enum(['markdown', 'lexical']),
})
```

## Common Patterns

### Optional Fields with Defaults

```typescript
z.boolean().default(true).optional()
z.number().default(0).optional()
z.array(z.string()).default([]).optional()
```

### Preprocessing

```typescript
// Empty string to null
z.preprocess(
  (val) => (val === '' ? null : val),
  z.string().nullable()
).optional()

// String to number
z.preprocess(
  (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
  z.number()
)
```

### Union Types

```typescript
z.union([z.string(), z.number()])
z.enum(['draft', 'published', 'archived'])
```

### Array Validation

```typescript
// Basic array
z.array(z.string())

// Length constraints
z.array(z.string()).min(1).max(10)

// Unique elements
zArrayUnique(z.string())
```

### Nested Objects

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
})

const UserSchema = z.object({
  name: z.string(),
  address: AddressSchema.optional(),
  addresses: z.array(AddressSchema).optional(),
})
```

### Conditional Validation

```typescript
// refine for custom validation
z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords must match' }
)
```

## Type Inference

```typescript
// Infer type from Schema
type MyType = z.infer<typeof MySchema>

// Use in Service
async create(data: z.infer<typeof MySchema>) {
  return this.repository.create(data)
}
```
