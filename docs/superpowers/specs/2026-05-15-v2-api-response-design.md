# V2 API Response Architecture — Design Spec

**Status:** Implemented — Phase 0–3 complete as of 2026-05-16
**Author:** Innei (with brainstorming assistance)
**Date:** 2026-05-15
**Scope:** Breaking refactor of the mx-core HTTP API response layer. No backwards compatibility with the current shape is required.

## Motivation

The current API response layer has accumulated four structural problems that hurt every consumer (Yohaku frontend, admin-vue3, future SDKs):

1. **Inconsistent envelope.** `ResponseInterceptor` wraps arrays as `{ data: [...] }` but lets plain objects pass through untouched. Paginated endpoints return `{ data, pagination }` directly. Whether a response carries a `data` wrapper depends on the controller's return type, so consumers cannot rely on a single shape.
2. **Schema-extrinsic fields mixed into the entity.** `is_liked`, `is_translated`, `translation_meta`, `enrichments`, `related`, etc. are spread onto the entity at the same level as its real columns. The entity's TypeScript type has to enumerate every cross-cutting decoration; consumers cannot distinguish "what the post is" from "what the server appended for this request".
3. **Field selection breaks shape.** The `select` query parameter strips fields after the service returns, yielding a `Partial<T>` that no downstream code can statically depend on.
4. **Layered transforms.** `ResponseInterceptor` (envelope), `JSONTransformInterceptor` (snake_case + `toJSON` recursion + `__v` deletion), and per-controller manual mapping (translation/enrichment spread) compound. A request travels through three serialization layers and consumers cannot reason about the final shape without running the code.

This document specifies a redesigned response architecture that fixes all four. It is a breaking refactor — no V1 namespace, no compatibility shim. The existing routes are rewritten in place.

## Goals

- Every successful JSON response has the same outer shape: `{ data, meta? }`.
- Every error JSON response has the same outer shape: `{ error: { code, message, details? } }`.
- The `data` field always carries the resource as defined by its schema. No injected derived fields.
- Cross-cutting / per-request data (pagination, translation, enrichment, interaction state) lives in `meta` with a stable, typed shape.
- Field selection is expressed as **named views** whose shapes are statically known and Zod-validated. There is no `Partial<T>` leak.
- Code is camelCase end to end (Drizzle column TS prop names, Zod DTOs, services). The response interceptor converts `data`/`meta` to snake_case at the wire boundary; the wire format stays snake_case.
- Non-JSON responses (streams, HTML, redirects) opt out cleanly via a single decorator.

## Non-Goals

- GraphQL or JSON:API style resource normalization. The few consumers we have do not benefit enough to justify the payload and client-side overhead.
- Backwards compatibility with V1. Consumers will be updated in lockstep.
- A formal API versioning scheme. There is no `/api/v2` namespace — the existing routes are rewritten.

## Design

### §1. Response Envelope

Success and error responses are disjoint:

```jsonc
// success
{ "data": T, "meta"?: ResponseMeta }

// error
{ "error": { "code": "STABLE_CODE", "message": "...", "details"?: {...} } }
```

Consumers branch on `'data' in res`. HTTP status codes remain semantically correct (2xx success, 4xx client error, 5xx server error); the envelope is in addition to, not in place of, status codes.

`ResponseInterceptor` is rewritten so that:

- A controller returning a value `T` is wrapped as `{ data: T }`.
- A controller returning `{ data, meta }` (the builder output) is passed through.
- A controller returning `undefined` produces `204 No Content` with no body.
- A `throw` is caught by the global exception filter and emitted as an error envelope.

`JSONTransformInterceptor` is removed — its `toJSON` recursion and `__v` deletion are obsolete (the Drizzle data layer returns plain objects, and `__v` was a Mongoose remnant). Its third job, camelCase → snake_case conversion, is kept but folded into `ResponseInterceptorV2` (see §2).

### §2. Case Convention: camelCase in Code, snake_case on the Wire

> Revised. An earlier draft of this section moved snake_case onto the schema layer (Drizzle column TS prop names + Zod DTOs). That forced every service, repository, and controller to spell DB fields in snake_case — too much friction in business code — so the decision was reversed: the code is camelCase end to end and a single interceptor converts at the boundary.

The codebase is camelCase: Drizzle column TS property names, Zod DTOs, service and controller code. The DB column names stay snake_case (each column keeps its explicit name string, e.g. `contentFormat: text('content_format')`).

```ts
posts = pgTable('posts', {
  createdAt: createdAt(),
  contentFormat: text('content_format').notNull(),
  isPublished: boolean('is_published').notNull().default(true),
})
```

`ResponseInterceptorV2` converts the response to snake_case at the wire boundary. After envelope shaping it runs `transformResponseCase` over `data` and `meta`:

- Object keys shaped like a camelCase identifier are converted (`createdAt` → `created_at`). Keys that are not identifiers — numeric ids, URLs, dotted paths — are left verbatim, so `meta.enrichments` (URL-keyed) and id-keyed `meta.interaction` / `meta.translation` maps survive untouched.
- `Date` instances and primitives pass through unchanged.
- The error envelope is produced by `AppExceptionFilter` and is not case-transformed; its `code` is already `SCREAMING_SNAKE`.

A handler opts a field subtree out of conversion with `@BypassCaseTransform([paths])` — paths root at `data`, use dotted segments, and `[]` marks an array level (`'items[].rawPayload'`). The matched subtree is emitted verbatim. Use it for free-form maps (user-defined JSON columns, snippet payloads) whose keys must reach the client unchanged.

Consequences:

- Service, repository, and controller code refers to `.createdAt`, `.isPublished` directly — camelCase throughout.
- Zod DTOs are camelCase.
- There is no per-controller `snakeCaseKeys` call and no `case.util.ts`; the single interceptor owns wire casing.

### §3. Named Views

Field selection is replaced with a finite set of named views per resource. Each view is a Zod schema picked from the full resource schema; consumers select a view by name.

```ts
// src/modules/post/post.views.ts
import { PostSchema } from './post.schema'

export const PostViews = {
  card: PostSchema.pick({
    id: true, title: true, slug: true, summary: true,
    category: true, created_at: true, cover: true,
  }),
  summary: PostSchema.pick({
    id: true, title: true, slug: true, summary: true, tags: true,
    category: true, created_at: true, modified_at: true,
  }),
  detail: PostSchema,
} as const

export type PostView = keyof typeof PostViews
export type PostOf<V extends PostView> = z.infer<(typeof PostViews)[V]>
```

Controller usage:

```ts
@Get('/')
async list(
  @Query('view') view: PostView = 'card',
  @Query() query: PostPagerDto,
) {
  const rows = await this.postService.listPaginated({ ...query })
  const schema = PostViews[view]
  const data = rows.data.map((row) => schema.parse(row))
  return {
    data,
    meta: new MetaObjectBuilder()
      .view(view)
      .pagination(rows.pagination)
      .build(),
  }
}
```

Rules:

- The query parameter is `?view=<name>`. Unrecognized names produce a 400 `INVALID_VIEW` error.
- Every endpoint declares a default view (list endpoints default to `card`, detail endpoints default to `detail`).
- New fields added to a resource must be explicitly assigned to a view; the default is "not included anywhere". This prevents accidental leaks.
- The response carries `meta.view: '<name>'` so consumers can statically narrow the type.
- Server-side, the view name may be forwarded to the service for DB-level `SELECT` projection. This is an optional follow-up optimization, not required by the initial migration.

### §4. Meta Convention and `MetaObjectBuilder`

The `meta` object is the home for everything that is not part of the resource schema: pagination, translation, interaction, enrichment, related references. Its top-level keys form a closed set, validated by Zod.

```ts
// src/common/response/meta.types.ts
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
})

export const ArticleTranslationSchema = z.object({
  is_translated: z.boolean(),
  source_lang: z.string().optional(),
  target_lang: z.string().optional(),
  model: z.string().optional(),
  translated_at: z.date().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  content_format: z.string().optional(),
  available_translations: z.array(z.string()).optional(),
})

// One resource's translation: its article body (`article`) plus translated
// referenced-entity fields keyed by dotted path (`fields`, e.g. `category.name`).
// `.strict()` lets the union in ResponseMetaSchema tell a single entry apart
// from an id-keyed map — snowflake ids never collide with `article`/`fields`.
export const EntryTranslationSchema = z
  .object({
    article: ArticleTranslationSchema.optional(),
    fields: z.record(z.string(), z.string()).optional(),
  })
  .strict()

export const InteractionMetaSchema = z
  .object({
    is_liked: z.boolean().optional(),
    like_count: z.number().int().nonnegative().optional(),
    read_count: z.number().int().nonnegative().optional(),
  })
  .strict()

export const ResponseMetaSchema = z.object({
  pagination: PaginationSchema.optional(),
  view: z.string().optional(),
  translation: z
    .union([
      EntryTranslationSchema,
      z.record(z.string(), EntryTranslationSchema),
    ])
    .optional(),
  interaction: z
    .union([
      InteractionMetaSchema,
      z.record(z.string(), InteractionMetaSchema),
    ])
    .optional(),
  enrichments: z.record(z.string().url(), EnrichmentEntrySchema).optional(),
  related: z.array(RelatedRefSchema).optional(),
})

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>
export type ArticleTranslation = z.infer<typeof ArticleTranslationSchema>
export type EntryTranslation = z.infer<typeof EntryTranslationSchema>
export type InteractionMeta = z.infer<typeof InteractionMetaSchema>
```

`translation` carries two concerns. `article` is the resource's own body re-rendered in the target language — the output of `TranslationService.translateArticle()`. `fields` is a flat map of dotted paths to translated strings for *referenced* entities the resource embeds (`category.name`, `topic.name`); it replaces the in-place rewrite that `@TranslateFields` performed. A detail response carries one `EntryTranslation`; a list carries `Record<itemId, EntryTranslation>`.

Per-item derived data in list responses uses a `Record<id, ...>` map shape, not per-item spread. Example:

```jsonc
{
  "data": [{ "id": "1", ... }, { "id": "2", ... }],
  "meta": {
    "view": "card",
    "pagination": { ... },
    // map keys below ("1", "2") are item ids — they match data[].id
    "interaction": {
      "1": { "is_liked": true },
      "2": { "is_liked": false }
    },
    "translation": {
      "1": {
        "article": { "is_translated": true, "title": "...", "target_lang": "en" },
        "fields": { "category.name": "..." }
      }
    }
  }
}
```

The builder constructs and validates `meta`:

```ts
// src/common/response/meta-builder.ts
export class MetaObjectBuilder {
  private meta: Partial<ResponseMeta> = {}

  pagination(p: z.input<typeof PaginationSchema>): this {
    this.meta.pagination = p
    return this
  }
  view(name: string): this {
    this.meta.view = name
    return this
  }
  translation(t: EntryTranslation | Map<string, EntryTranslation>): this {
    this.meta.translation = t instanceof Map ? Object.fromEntries(t) : t
    return this
  }
  interaction(i: InteractionMeta | Map<string, InteractionMeta>): this {
    this.meta.interaction = i instanceof Map ? Object.fromEntries(i) : i
    return this
  }
  enrichments(e: Record<string, EnrichmentEntry>): this {
    this.meta.enrichments = e
    return this
  }
  related(r: RelatedRef[]): this {
    this.meta.related = r
    return this
  }

  build(): ResponseMeta {
    return ResponseMetaSchema.parse(this.meta)
  }
}
```

Adding a new top-level meta key requires editing both `ResponseMetaSchema` and adding a builder method. This is intentional: it forces a code review for every new cross-cutting concern.

### §5. Error Envelope

Errors carry a stable machine code, a human-readable message, and optional structured details.

```ts
// src/common/response/error.types.ts
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
```

Error codes follow `SCREAMING_SNAKE_CASE`, grouped by domain:

```
POST_NOT_FOUND
POST_UNPUBLISHED
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
VALIDATION_FAILED          // details: { issues: ZodIssue[] }
RATE_LIMITED
INTERNAL_ERROR
HTTP_ERROR                 // catch-all for HttpException without an explicit code
```

A typed exception class carries the code:

```ts
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status)
  }
}

export class PostNotFoundException extends AppException {
  constructor(id?: string) {
    super('POST_NOT_FOUND', 'Post not found', 404, id ? { id } : undefined)
  }
}
```

A global `AppExceptionFilter` maps every thrown error to the envelope:

```ts
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse()
    if (exception instanceof AppException) {
      return res
        .status(exception.getStatus())
        .send({
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
        })
    }
    if (exception instanceof ZodError) {
      return res.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: { issues: exception.issues },
        },
      })
    }
    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).send({
        error: { code: 'HTTP_ERROR', message: exception.message },
      })
    }
    return res.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
}
```

Existing custom exceptions (`CannotFindException`, etc.) are migrated to `AppException` subclasses with explicit codes.

### §6. Write-Method Response

POST, PATCH, PUT, and DELETE always return the affected entity inside `{ data }`. Consumers do not need a separate refetch to update their UI.

```ts
@Post('/')
async create(@Body() dto: PostDto) {
  const created = await this.postService.create(dto)
  return { data: PostViews.detail.parse(created) }     // 201
}

@Patch('/:id')
async update(@Param() { id }: EntityIdDto, @Body() dto: PartialPostDto) {
  const updated = await this.postService.update(id, dto)
  return { data: PostViews.detail.parse(updated) }     // 200
}

@Delete('/:id')
async remove(@Param() { id }: EntityIdDto) {
  const deleted = await this.postService.delete(id)
  return { data: PostViews.card.parse(deleted) }       // 200, card view enough for cache invalidation
}
```

Conventions:

- POST → 201, body = `{ data: <detail view> }`
- PATCH/PUT → 200, body = `{ data: <detail view> }`
- DELETE → 200, body = `{ data: <card view> }`
- Bulk write (e.g., batch delete) → `{ data: { count: N, ids?: string[] } }`. The affected count is the operation's primary result, not cross-cutting request metadata, so it stays in `data` and out of `meta`. Bulk delete does not echo full deleted entities.
- Long-running operations (build trigger, queued job) → `{ data: { task_id, status } }`; consider `@RawResponse` only if streaming progress.

### §7. `@RawResponse` Decorator (replaces `@HTTPDecorators.Bypass`)

Bypass was originally an escape hatch from the `ResponseInterceptor` + `JSONTransformInterceptor` stack. `@RawResponse` opts a route out of the whole envelope-and-casing pipeline; its only purpose now is **the response body is not JSON** (`@BypassCaseTransform` handles the narrower case of skipping casing for a JSON subtree):

- binary streams (file download, image proxy)
- HTML (pageproxy, render controllers)
- redirects (shortlinks)
- RSS / XML feeds (different content type)
- snippet routes (user-defined content types)

The decorator is renamed `@RawResponse` to make this semantic explicit. Several existing `Bypass` usages can be removed entirely because their responses can fit inside the envelope:

- `/ping` health → `{ data: { ok: true } }`
- `/server-time` → `{ data: <unix-timestamp> }`
- webhooks → unless a third party requires a specific shape, follow the envelope

Error handling rule: even on a `@RawResponse` route, the `AppExceptionFilter` still applies. A thrown `AppException` emits a JSON error envelope (with `Content-Type: application/json`), regardless of what the success response would have looked like. This keeps error shape uniform for monitoring/Sentry.

### §8. Translation, Enrichment, and Interaction Integration

The current `@TranslateFields` decorator + `translation-entry.interceptor.ts` mutates `data` in place along JSONPath-like strings (`data[].category.name`). This is the main source of "schema-extrinsic data mixed in". It is removed.

In the new design, cross-cutting per-request data is collected by the controller and pushed into `meta` via the builder. Consumers learn about translation/interaction state by reading `meta`, not by detecting injected fields.

```ts
@Get('/:id')
async getById(
  @Param() { id }: EntityIdDto,
  @Lang() lang?: string,
  @Ip() ip?: string,
) {
  const post = await this.postService.findById(id)
  if (!post) throw new PostNotFoundException(id)

  const [article, enrichments, isLiked, categoryName] = await Promise.all([
    lang
      ? this.translationService.translateArticle({
          articleId: post.id,
          targetLang: lang,
          originalData: {
            title: post.title,
            text: post.text,
            summary: post.summary,
            tags: post.tags,
          },
        })
      : null,
    this.enrichmentService.collect(post),
    this.countingService.isLiked(post.id, ip),
    lang
      ? this.translationService.translateField({
          key: post.category.name,
          lang,
        })
      : null,
  ])

  const data = PostViews.detail.parse(post)

  const meta = new MetaObjectBuilder()
    .view('detail')
    .translation({
      article: article ? toArticleTranslation(article) : undefined,
      fields: categoryName ? { 'category.name': categoryName } : undefined,
    })
    .enrichments(enrichments)
    .interaction({ is_liked: isLiked })
    .related(post.related)
    .build()

  return { data, meta }
}
```

The `article` passed to `.translation()` must match `ArticleTranslationSchema`. `translateArticle()` returns the internal `TranslationResult` (nested `translation_meta`, camelCase flags); a thin `toArticleTranslation()` mapper flattens it into `ArticleTranslation` before it reaches the builder. `EntryTranslationSchema.parse()` inside `build()` is the final guard.

Consumer responsibility: when rendering translated content, prefer `meta.translation.article.title`; fall back to `data.title`. The fallback is explicit, not server-side magic.

The `applyContentPreference` helper (currently mutates `data` based on a language preference) is removed. The choice of which language to render is now the client's, given the same set of inputs in `data` + `meta`.

### §9. Pagination DTO Unification

A single shared pagination DTO factory replaces per-module `PostPagerDto`, `NotePagerDto`, etc.:

```ts
// src/shared/dto/pager.dto.ts
export const createPagerSchema = <TSort extends [string, ...string[]]>(
  sortKeys: TSort,
) =>
  z.object({
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().max(100).default(10),
    view: z.string().optional(),
    sort_by: z.enum(sortKeys).optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    year: z.coerce.number().int().optional(),
  })

export const PostPagerSchema = createPagerSchema([
  'created_at',
  'modified_at',
  'title',
]).extend({
  category_ids: z.array(z.string()).optional(),
  truncate: z.coerce.number().int().optional(),
})
```

Service-layer pagination return shape is also unified:

```ts
interface PaginateResult<T> {
  data: T[]
  pagination: Pagination
}
```

The service returns `{ data, pagination }`; the controller passes `pagination` to the builder rather than letting it leak into the response root.

### §10. File and Module Organization

```
src/common/response/
  envelope.types.ts          # success/error envelope unions
  meta.types.ts              # ResponseMetaSchema + sub schemas
  meta-builder.ts            # MetaObjectBuilder
  error.types.ts             # ErrorResponseSchema, AppException
  app-exception.filter.ts    # AppExceptionFilter
  raw-response.decorator.ts  # @RawResponse
  response.interceptor.ts    # rewritten envelope interceptor

src/common/views/
  view.types.ts              # ViewDef, ViewOf helpers

src/modules/<resource>/
  <resource>.schema.ts       # Zod + Drizzle inferred
  <resource>.views.ts        # per-resource view definitions
  <resource>.controller.ts   # uses Views + MetaObjectBuilder
  <resource>.service.ts      # returns raw rows + pagination
```

Layering rules:

- The **service** layer returns raw rows (or `PaginateResult`). It does not know about views or meta.
- The **controller** layer parses raw rows through a view, builds meta, and returns `{ data, meta }`.
- The **interceptor** layer handles envelope wrapping (a bare `T` becomes `{ data: T }`) and content-type handling for `@RawResponse`.

### §11. Migration Strategy

Although the rewrite is breaking from the consumer perspective, the server-side refactor is staged to keep PRs reviewable:

1. **Infrastructure PR.** Add `src/common/response/*` (envelope types, meta types, builder, error types, filter, `@RawResponse`, rewritten interceptor). Both `JSONTransformInterceptor` and the new interceptor coexist temporarily. No controller is migrated yet.
2. **Schema rename PRs (per module).** One PR per resource (post, note, page, comment, ...) that renames Drizzle column TS props and Zod DTO keys to snake_case and ripples the change through services, controllers, and tests. No DB SQL migration is required since only TS prop names change.
3. **Module migration PRs (per module).** Define `*.views.ts`, rewrite the controller to use `MetaObjectBuilder`, replace `@TranslateFields` usages with explicit translation calls, and switch exceptions to `AppException` subclasses.
4. **Cleanup PR.** Remove `JSONTransformInterceptor`, `@TranslateFields`, `translation-entry.interceptor.ts`, `snakecaseKeys*` utilities, and the legacy `Bypass` alias.

Each stage is independently mergeable and independently testable. The consumer-side refactor (Yohaku, admin) is coordinated against the cleanup PR.

### §12. Testing

- **Envelope shape (e2e).** A sampling test covering one endpoint per resource asserts the success shape is `{ data, meta? }` and the error shape is `{ error: { code, message } }`. A small set of canonical error cases (not found, unauthorized, validation) is included.
- **View parsing (unit).** For each view definition, `safeParse` a full row to confirm the view picks exactly the intended fields, and `safeParse` an under-populated row to confirm required fields fail correctly.
- **Meta builder (unit).** A test per builder method asserts that the resulting `build()` validates against `ResponseMetaSchema` and that omitted keys are absent from the output.
- **Migration regression (e2e snapshots).** For 5–10 critical endpoints (post detail, post list, post create, post update, auth login, file upload, comment create), capture a snapshot of the response shape and diff before/after migration. This catches shape regressions that unit tests miss.

## Resolved Decisions

Both blocking design questions were resolved on 2026-05-15; the design above already reflects them.

### `translation` meta shape (§4 vs §8) → nested `{ article, fields }`

`TranslationMetaSchema` is removed. Translation meta is modeled by two schemas: `ArticleTranslationSchema` (the translated article body — output of `TranslationService.translateArticle()`) and `EntryTranslationSchema` = `{ article?: ArticleTranslation; fields?: Record<string, string> }`. `ResponseMetaSchema.translation` is `EntryTranslation` for a detail response and `Record<itemId, EntryTranslation>` for a list. The flat `title`/`summary`/`text`/`tags` fields from the old schema move under `article`; translated referenced-entity fields (`category.name`, `topic.name`) live in `fields`. `EntryTranslationSchema` and `InteractionMetaSchema` are `.strict()` so the `single | id-keyed-map` union is unambiguous — snowflake ids never collide with the literal keys `article`/`fields`/`is_liked`. `MetaObjectBuilder.translation()` accepts `EntryTranslation | Map<string, EntryTranslation>`, matching the `§8` controller usage.

*Rejected:* a separate id-keyed `entities` meta key for referenced-entity translations. It would break the closed six-key set and force every consumer into an id join to save a few short duplicated strings — not worth it (YAGNI).

### `meta.count` (§6) → carried in `data`, not `meta`

Bulk-write endpoints return `{ data: { count: N, ids?: string[] } }`. The affected count is the operation's primary result, not cross-cutting request metadata, so it has no place in `meta`; the closed six-key `ResponseMetaSchema` set is unchanged. `§6`'s earlier `{ data: entity[], meta: { count } }` was doubly wrong — verified against the codebase, bulk delete never returned an `entity[]` (`comment.batchDelete` returns no body, `subscribe.unsubscribeBatch` returns `{ deletedCount }`).

## Open Questions

All remaining items are non-blocking and deferred to implementation:

- Exact list of named views per resource. The default trio (`card`, `summary`, `detail`) covers the common cases; uncommon resources may add or omit views.
- Whether to forward the view name to the service for DB-level `SELECT` projection. This is an optimization; the initial migration keeps the projection at the controller layer.
- Whether to add an `ApiResponse` OpenAPI decorator generator that infers the envelope + view from controller types. Useful for SDK generation, but not on the critical path.
