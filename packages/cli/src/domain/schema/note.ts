import { Schema } from 'effect'

import { TopicSchema } from './topic'

export const NoteSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  // `nid` is required by api-client but stays loose so legacy / older
  // payloads decode cleanly.
  nid: Schema.optional(Schema.Any),
  slug: Schema.optional(Schema.Any),
  text: Schema.optional(Schema.Any),
  content: Schema.optional(Schema.Any),
  contentFormat: Schema.optional(Schema.Any),
  isPublished: Schema.optional(Schema.Any),
  hasPassword: Schema.optional(Schema.Any),
  publicAt: Schema.optional(Schema.Any),
  mood: Schema.optional(Schema.Any),
  weather: Schema.optional(Schema.Any),
  bookmark: Schema.optional(Schema.Any),
  location: Schema.optional(Schema.Any),
  coordinates: Schema.optional(Schema.Any),
  topicId: Schema.optional(Schema.Any),
  topic: Schema.optional(Schema.Union(TopicSchema, Schema.Null)),
  summary: Schema.optional(Schema.Any),
  meta: Schema.optional(Schema.Any),
  images: Schema.optional(Schema.Any),
  readCount: Schema.optional(Schema.Any),
  likeCount: Schema.optional(Schema.Any),
  createdAt: Schema.optional(Schema.Any),
  modifiedAt: Schema.optional(Schema.Any),
  enrichments: Schema.optional(Schema.Any),
})

export type Note = Schema.Schema.Type<typeof NoteSchema>

export const NoteListResponse = Schema.Struct({
  data: Schema.Array(NoteSchema),
  pagination: Schema.optional(Schema.Any),
})

export type NoteListResponse = Schema.Schema.Type<typeof NoteListResponse>
