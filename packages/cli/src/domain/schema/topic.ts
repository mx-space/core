import { Schema } from 'effect'

export const TopicSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  // Loose fields — mirror api-client `TopicModel` without forcing nullability
  // shape since the wire payload occasionally omits them.
  description: Schema.optional(Schema.Any),
  introduce: Schema.optional(Schema.Any),
  icon: Schema.optional(Schema.Any),
  createdAt: Schema.optional(Schema.Any),
})

export type Topic = Schema.Schema.Type<typeof TopicSchema>

export const TopicListResponse = Schema.Struct({
  data: Schema.Array(TopicSchema),
  pagination: Schema.optional(Schema.Any),
})

export type TopicListResponse = Schema.Schema.Type<typeof TopicListResponse>
