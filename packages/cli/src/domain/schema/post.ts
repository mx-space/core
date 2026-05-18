import { Schema } from 'effect'

import { CategorySchema } from './category'

// Strictly typed: `id`, `title`, `slug` are the fields the CLI surfaces in
// every output mode (`readable`, `llm`, `envelope`). Everything else is left
// as `Schema.Any` so server-side additions (new flags, enrichments, etc.) do
// not break decoding.
export const PostSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  // Optional / loose typed fields
  text: Schema.optional(Schema.Any),
  content: Schema.optional(Schema.Any),
  contentFormat: Schema.optional(Schema.Any),
  summary: Schema.optional(Schema.Any),
  copyright: Schema.optional(Schema.Any),
  tags: Schema.optional(Schema.Any),
  isPublished: Schema.optional(Schema.Any),
  pinAt: Schema.optional(Schema.Any),
  pinOrder: Schema.optional(Schema.Any),
  categoryId: Schema.optional(Schema.Any),
  category: Schema.optional(CategorySchema),
  meta: Schema.optional(Schema.Any),
  images: Schema.optional(Schema.Any),
  readCount: Schema.optional(Schema.Any),
  likeCount: Schema.optional(Schema.Any),
  createdAt: Schema.optional(Schema.Any),
  modifiedAt: Schema.optional(Schema.Any),
  related: Schema.optional(Schema.Any),
  enrichments: Schema.optional(Schema.Any),
})

export type Post = Schema.Schema.Type<typeof PostSchema>

export const PostListResponse = Schema.Struct({
  data: Schema.Array(PostSchema),
  pagination: Schema.optional(Schema.Any),
})

export type PostListResponse = Schema.Schema.Type<typeof PostListResponse>
