import { Schema } from 'effect'

export const PageSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  subtitle: Schema.optional(Schema.Any),
  text: Schema.optional(Schema.Any),
  content: Schema.optional(Schema.Any),
  contentFormat: Schema.optional(Schema.Any),
  order: Schema.optional(Schema.Any),
  type: Schema.optional(Schema.Any),
  options: Schema.optional(Schema.Any),
  meta: Schema.optional(Schema.Any),
  images: Schema.optional(Schema.Any),
  createdAt: Schema.optional(Schema.Any),
  modifiedAt: Schema.optional(Schema.Any),
  enrichments: Schema.optional(Schema.Any),
})

export type Page = Schema.Schema.Type<typeof PageSchema>

export const PageListResponse = Schema.Struct({
  data: Schema.Array(PageSchema),
  pagination: Schema.optional(Schema.Any),
})

export type PageListResponse = Schema.Schema.Type<typeof PageListResponse>
