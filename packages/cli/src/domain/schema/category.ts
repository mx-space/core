import { Schema } from 'effect'

// CategoryType enum mirrors `@mx-space/api-client` `CategoryType` (0 = category, 1 = tag).
// We accept either numeric or string forms because legacy responses occasionally
// stringify the value.
export const CategoryTypeSchema = Schema.Union(
  Schema.Literal(0, 1),
  Schema.Literal('0', '1'),
)

export const CategorySchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  // Unknown / loosely typed fields — kept as `Any` so server-side additions
  // don't break decoding. Critical fields above are strictly typed.
  createdAt: Schema.optional(Schema.Any),
  type: Schema.optional(Schema.Any),
  count: Schema.optional(Schema.Any),
})

export type Category = Schema.Schema.Type<typeof CategorySchema>

export const CategoryListResponse = Schema.Struct({
  data: Schema.Array(CategorySchema),
  pagination: Schema.optional(Schema.Any),
})

export type CategoryListResponse = Schema.Schema.Type<
  typeof CategoryListResponse
>
