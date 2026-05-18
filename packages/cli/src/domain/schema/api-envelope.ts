import { Schema } from 'effect'

/**
 * Wire-format error envelope emitted by `Renderer.emitError` (and consumed
 * by tests as a regression oracle). Mirrors `MxsError.toJSON()` from the
 * v0.2.x core, plus the `tagToCode` table in `domain/errors.ts`.
 */
export const ErrorEnvelopeSchema = Schema.Struct({
  ok: Schema.Literal(false),
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
  hint: Schema.optional(Schema.String),
})

export type ErrorEnvelope = Schema.Schema.Type<typeof ErrorEnvelopeSchema>

/**
 * Server-side pagination block. mx-core servers emit `page/size/total` —
 * the CLI also accepts the legacy aliases (`currentPage`/`pageSize`/
 * `totalCount`) for back-compat with old fixtures.
 */
export const PaginationSchema = Schema.Struct({
  page: Schema.optional(Schema.Number),
  size: Schema.optional(Schema.Number),
  total: Schema.optional(Schema.Number),
  totalPage: Schema.optional(Schema.Number),
  currentPage: Schema.optional(Schema.Number),
  pageSize: Schema.optional(Schema.Number),
  totalCount: Schema.optional(Schema.Number),
})

export type Pagination = Schema.Schema.Type<typeof PaginationSchema>

/**
 * `{ data, pagination }` envelope — produced by paginator-decorated
 * controllers in mx-core (`ResponseInterceptor`).
 */
export const paginatedEnvelopeSchema = <A, I, R>(
  item: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    data: Schema.Array(item),
    pagination: Schema.optional(PaginationSchema),
  })

/**
 * `{ data: [...] }` envelope — produced by array responses without
 * paginator decoration.
 */
export const dataArrayEnvelopeSchema = <A, I, R>(
  item: Schema.Schema<A, I, R>,
) =>
  Schema.Struct({
    data: Schema.Array(item),
  })

/**
 * Common server error body shape — used to extract the human `message`
 * when mapping non-2xx responses to `TaggedError`s.
 */
export const ServerErrorBodySchema = Schema.Struct({
  message: Schema.optional(
    Schema.Union(Schema.String, Schema.Array(Schema.String)),
  ),
  code: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Unknown),
})

export type ServerErrorBody = Schema.Schema.Type<typeof ServerErrorBodySchema>

/**
 * Extract a flattened `message` string from an arbitrary error body,
 * matching the legacy `extractMessage` helper in `api-client.ts`.
 */
export const extractServerMessage = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null
  const msg = (body as Record<string, unknown>).message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg) && typeof msg[0] === 'string') return msg.join('; ')
  return null
}
