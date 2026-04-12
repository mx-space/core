# Canonical String ID Refactor Design

## Summary

Refactor the application to adopt a single canonical identifier model:

| Layer | Canonical representation |
| --- | --- |
| MongoDB storage | `_id: ObjectId` |
| Mongoose query boundary | `Types.ObjectId` |
| Application, transport, events, DTOs, views | `id: ObjectIdString` |

This refactor is intentionally **non-compatible**:

| Rule | Decision |
| --- | --- |
| `_id` in HTTP responses | Removed |
| `_id` in business event payloads | Removed |
| `_id` fallback reads such as `doc.id ?? doc._id?.toString?.()` | Forbidden |
| Union inputs such as `string \| ObjectId \| { _id?: ... }` in business logic | Forbidden |
| Mixed `id/_id` translation lookup rules | Removed |

The database primary key mechanism remains MongoDB-native. The refactor changes the application contract, not the storage primitive.

## Motivation

### Current Failure Modes

| Symptom | Example location | Root cause |
| --- | --- | --- |
| Repeated fallback chains | `page.controller.ts`, `note.controller.ts`, `post.controller.ts` | No canonical identifier contract after query serialization |
| Event handlers accept multiple payload shapes | `ai-translation.service.ts` | Create/update/delete events are not standardized |
| Nested populated objects expose `_id` but not `id` | `TranslateFields(... idField: '_id')` usages | Current lean plugin does not recursively normalize nested objects |
| Service signatures accept mixed identifier types | `comment.service.ts`, `auth.service.ts` | Type system does not distinguish storage IDs from application IDs |
| View models still retain `_id` | `owner.model.ts`, `search-document.util.ts` | DTO/view layer is not isolated from persistence structure |

### Architectural Objective

```text
┌─────────────────────────────┐
│ MongoDB / Mongoose internals│
│ _id: ObjectId              │
└──────────────┬──────────────┘
               │ parse / serialize exactly once
               ▼
┌─────────────────────────────┐
│ Shared ID boundary          │
│ ObjectIdString (branded)    │
└──────────────┬──────────────┘
               │ reused everywhere else
               ▼
┌───────────────────────────────────────────────────────┐
│ Controllers │ Services │ Events │ Interceptors │ DTOs │
│ id only, no _id, no fallback, no mixed unions        │
└───────────────────────────────────────────────────────┘
```

## Goals

| Goal | Description |
| --- | --- |
| Single identifier contract | All application-facing entities expose only `id` |
| Type safety | Branded ID types prevent accidental use of arbitrary `string` values |
| Zero compatibility paths | No dual-shape payloads, no fallbacks, no conditional coercion outside the persistence boundary |
| Recursive normalization | Nested populated documents and lean results also expose only `id` |
| Enforceability | Lint and type definitions make regressions difficult to reintroduce |

## Non-Goals

| Non-goal | Rationale |
| --- | --- |
| Replacing MongoDB `_id` with a custom primary key field | High cost, no benefit for the current problem |
| Retaining transitional support for `_id` in application code | Explicitly rejected by requirement |
| Preserving wire compatibility for undocumented WebSocket or internal event consumers | This is a deliberate breaking change |
| Refactoring Mongo aggregation internals to avoid `_id` inside pipeline stages | `_id` remains acceptable inside aggregation machinery, but must not escape the boundary |

## Design Decisions

1. **`id` is the sole application identifier.**
2. **`_id` is a storage detail and may appear only in schema definitions, Mongoose filters, populate metadata, and aggregation internals.**
3. **All request DTOs, response DTOs, event payloads, view models, utility types, and translation rules must use `id` only.**
4. **All business events carry a structured typed payload with `id`; raw document payloads are removed.**
5. **The shared normalization layer must remove `_id`, not merely mirror it.**
6. **No service or controller may accept `string | Types.ObjectId` unions.**
7. **Breaking change rollout is atomic; there is no compatibility flag, adapter, or shim.**

## Target Invariants

| Invariant | Required state |
| --- | --- |
| HTTP JSON payloads | Never contain `_id` |
| WebSocket payloads | Never contain `_id` |
| Business event payloads | Always structured, always include `id`, never include `_id` |
| Lean query result | Contains `id`, does not contain `_id`, including nested populated objects |
| `toJSON()` / `toObject()` result | Contains `id`, does not contain `_id` |
| Route parameter type | Branded `ObjectIdString` or an explicit union such as `number \| ObjectIdString` where route semantics demand it |
| Translation field rules | `idField` may only be `'id'` |
| Search indexing inputs | `refId` derived from `id`, not from `_id` |

## Type System Design

### Canonical ID Types

Create a dedicated shared ID module:

| File | Responsibility |
| --- | --- |
| `apps/core/src/shared/id/id.type.ts` | Branded type declarations |
| `apps/core/src/shared/id/id.schema.ts` | Zod schemas for branded IDs |
| `apps/core/src/shared/id/id.util.ts` | Boundary-only conversion helpers |
| `apps/core/src/shared/id/index.ts` | Public exports |

### Required Types

```ts
declare const objectIdBrand: unique symbol

export type ObjectIdString = string & {
  readonly [objectIdBrand]: 'ObjectIdString'
}

export type EntityId<Name extends string> = ObjectIdString & {
  readonly __entity: Name
}

export type PostId = EntityId<'post'>
export type NoteId = EntityId<'note'>
export type PageId = EntityId<'page'>
export type RecentlyId = EntityId<'recently'>
export type CommentId = EntityId<'comment'>
export type ReaderId = EntityId<'reader'>
export type CategoryId = EntityId<'category'>
export type TopicId = EntityId<'topic'>
```

### Required Schemas

```ts
export const zObjectIdString = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Invalid MongoDB ObjectId')
  .transform((value) => value as ObjectIdString)
```

### Conversion Rules

| Function | Allowed location | Purpose |
| --- | --- | --- |
| `parseObjectIdString(value)` | DTO and request boundary | Validate and brand |
| `toObjectId(id: ObjectIdString)` | Persistence boundary only | Convert branded string to `Types.ObjectId` |
| `toObjectIdArray(ids: readonly ObjectIdString[])` | Persistence boundary only | Bulk conversion |
| `brandEntityId<'post'>(id)` | Service boundary | Narrow generic ID to domain-specific ID |

### Explicitly Forbidden Types

```ts
string | Types.ObjectId
string | Types.ObjectId | { _id?: unknown }
{ id?: string; _id?: unknown }
```

These unions are prohibited in controllers, services, interceptors, event handlers, utility functions, and view models.

## Serialization and Lean Normalization

### Base Model Contract

`apps/core/src/shared/model/base.model.ts` must be updated so that:

| Method | Required behavior |
| --- | --- |
| `toJSON` | Add `id`, remove `_id`, retain getters and virtuals |
| `toObject` | Add `id`, remove `_id`, retain getters and virtuals |
| `BaseModel.id` type | `ObjectIdString` |

### Lean Plugin Contract

`apps/core/src/shared/model/plugins/lean-id.ts` must be replaced with a recursive canonicalization plugin.

Required behavior:

| Case | Result |
| --- | --- |
| Root lean document | `id` added, `_id` removed |
| Nested populated object | `id` added, `_id` removed |
| Nested array of populated objects | Every element normalized recursively |
| Primitive `ObjectId` value that is not a document | Left intact unless the field is explicitly an identifier field |

This plugin is the enabling change for removing `idField: '_id'` from translation decorators.

### JSON Transform Interceptor

`apps/core/src/common/interceptors/json-transform.interceptor.ts` must not be used as a compatibility scrubber. Its role remains structural serialization only. The canonical `id` contract must already hold before response serialization.

## Boundary Rules

### Allowed `_id` Usage

| Allowed area | Examples |
| --- | --- |
| Mongoose schema metadata | `foreignField: '_id'`, `schemaOptions._id` |
| Query filters adjacent to model calls | `{ _id: toObjectId(id) }` |
| Aggregation internal stages | `$group: { _id: ... }`, `$project: { id: '$_id' }` |
| Migration scripts | Historical data maintenance |

### Forbidden `_id` Usage

| Forbidden area | Examples |
| --- | --- |
| Controller response assembly | `doc._id?.toString?.()` |
| Event payload shape | `{ _id: ... }` |
| Service-level identity comparison | `String(doc._id) === ...` |
| Utility types | `_id?: { toString(): string }` |
| Translation decorators | `idField: '_id'` |
| View model contracts | `OwnerModel._id` |

## Event Model Refactor

### Canonical Event Payload

Create typed event payload definitions:

| File | Responsibility |
| --- | --- |
| `apps/core/src/processors/helper/helper.event.types.ts` | Event payload map and typed helpers |

Required lifecycle payload shape:

```ts
type EntityLifecyclePayload<TName extends string> = {
  id: EntityId<TName>
}
```

### Event Contract Changes

| Event family | Old shape | New shape |
| --- | --- | --- |
| `POST_CREATE`, `POST_UPDATE` | Full document | `{ id: PostId }` |
| `NOTE_CREATE`, `NOTE_UPDATE` | Full document | `{ id: NoteId }` |
| `PAGE_CREATE`, `PAGE_UPDATE` | Full document | `{ id: PageId }` |
| `CATEGORY_*`, `TOPIC_*` | Mixed document / `{ id }` | `{ id: CategoryId }`, `{ id: TopicId }` |
| `COMMENT_CREATE` | Full comment document | `{ id: CommentId }` |
| `*_DELETE` | Already close to `{ id }` | Remain `{ id }`, strongly typed |

### Consequences

| Consumer | Required change |
| --- | --- |
| `ai-translation-event-handler.service.ts` | Load entity by `id`; delete handlers use `id` directly |
| `helper.event-payload.service.ts` | Enrich from `id` only |
| `visitor-event-dispatch.service.ts` | Never inspect `_id`; operate on canonical `id` |
| `comment.lifecycle.service.ts` | Broadcast `id` only; reload comment if payload enrichment is required |

### Explicit Removal

`apps/core/src/modules/ai/ai-translation/ai-translation.types.ts` must remove:

```ts
type ArticleEventDocument = { _id?: ... }
type ArticleEventPayload = ArticleEventDocument | { data: string } | { id: string }
```

Replace with:

```ts
type ArticleEventPayload = { id: PostId | NoteId | PageId }
```

## DTO and Validation Refactor

### Required Changes

| File | Required modification |
| --- | --- |
| `apps/core/src/common/zod/primitives.ts` | Export branded `zObjectIdString` or upgrade `zMongoId` to return branded type |
| `apps/core/src/common/zod/index.ts` | Re-export branded schema |
| `apps/core/src/shared/dto/id.dto.ts` | `MongoIdDto.id` becomes `ObjectIdString`; `IntIdOrMongoIdDto` becomes `number | ObjectIdString` |
| `apps/core/src/shared/dto/pager.dto.ts` | `before/after` use branded IDs |

### DTO Rule

Route handlers must receive already-branded IDs. No controller may re-validate or re-coerce the same identifier.

## Translation Field Refactor

### Decorator Contract

`apps/core/src/common/decorators/translate-fields.decorator.ts` must narrow:

```ts
idField?: 'id'
```

There is no remaining reason to allow arbitrary identifier field names.

### Required Call-Site Changes

The following files must replace every `idField: '_id'` with `idField: 'id'`:

| File |
| --- |
| `apps/core/src/modules/post/post.controller.ts` |
| `apps/core/src/modules/note/note.controller.ts` |
| `apps/core/src/modules/topic/topic.controller.ts` |
| `apps/core/src/modules/category/category.controller.ts` |

`apps/core/src/common/interceptors/translation-entry.interceptor.ts` must collect entity IDs from `parent.id` only.

## Service and Controller Refactor Inventory

### Shared Infrastructure

| File | Change |
| --- | --- |
| `apps/core/src/shared/model/base.model.ts` | Brand `id`, strip `_id` in serialization |
| `apps/core/src/shared/model/plugins/lean-id.ts` | Recursive canonical normalization |
| `apps/core/src/transformers/crud-factor.transformer.ts` | Broadcast typed `{ id }` payloads only |
| `apps/core/src/processors/database/database.service.ts` | Accept branded IDs; return documents with canonical `id` only |

### HTTP Controllers

Remove every fallback expression shaped like `item._id?.toString?.() ?? item.id ?? ...` from:

| File | Required state after refactor |
| --- | --- |
| `apps/core/src/modules/page/page.controller.ts` | Read `doc.id` only |
| `apps/core/src/modules/note/note.controller.ts` | Read `note.id` only |
| `apps/core/src/modules/post/post.controller.ts` | Read `doc.id` only |
| `apps/core/src/modules/activity/activity.controller.ts` | Read `item.id` only |
| `apps/core/src/modules/aggregate/aggregate.controller.ts` | Read `item.id` only |
| `apps/core/src/modules/category/category.controller.ts` | Read `item.id` only |
| `apps/core/src/modules/comment/comment.controller.ts` | Read `comment.id` only |
| `apps/core/src/modules/file/file.controller.ts` | Return string `id`, not raw `_id` |

### Domain Services

| File | Change |
| --- | --- |
| `apps/core/src/modules/comment/comment.service.ts` | Replace local mixed-ID helpers with branded boundary conversion; internal comparisons use canonical `id` |
| `apps/core/src/modules/comment/comment.lifecycle.service.ts` | Remove `(comment as any)._id` reads |
| `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts` | Eliminate event fallback extraction logic; use `id` only |
| `apps/core/src/modules/ai/ai-translation/ai-translation-event-handler.service.ts` | Load documents by typed `id` |
| `apps/core/src/modules/activity/activity.service.ts` | Build maps by `id`, not `_id.toHexString()` |
| `apps/core/src/modules/search/search-document.util.ts` | Source type exposes `id` only |
| `apps/core/src/modules/search/search.service.ts` | Typed search sources and result grouping use canonical IDs |
| `apps/core/src/modules/recently/recently.service.ts` | Internal foreign ID maps may use ObjectId at query time, but view models expose only `id` |
| `apps/core/src/modules/owner/owner.service.ts` | Return `OwnerModel` without `_id` |
| `apps/core/src/modules/serverless/serverless.service.ts` | Remove owner `_id` fallback in returned identity objects |
| `apps/core/src/modules/markdown/markdown.service.ts` | Returned category objects expose `id`, not `_id` |

### Model and View Types

| File | Change |
| --- | --- |
| `apps/core/src/modules/owner/owner.model.ts` | Remove `_id` property entirely |
| `apps/core/src/modules/recently/recently.model.ts` | `refId` getter returns canonical `id` from populated refs, never `_id` |
| `apps/core/src/modules/ai/ai-translation/ai-translation.types.ts` | Replace mixed document payload types with `id`-only event payloads |
| `apps/core/src/modules/search/search-document.util.ts` | Remove `_id` from `SearchDocumentSource` |

## Query and Persistence Rules

### Query Rule

Every direct Mongoose lookup by identifier must follow this pattern:

```ts
const objectId = toObjectId(id)
return this.model.findOne({ _id: objectId })
```

There is no acceptable pattern in which a service accepts both `string` and `Types.ObjectId`.

### Aggregation Rule

Aggregation pipelines may use Mongo `_id` internally, but must project to named fields before the result leaves the service:

```ts
{ $group: { _id: '$categoryId', count: { $sum: 1 } } },
{ $project: { id: '$_id', count: 1, _id: 0 } }
```

The public result type must not contain `_id`.

## Lint Enforcement

`eslint.config.mjs` must add a restricted-usage policy:

| Rule | Scope |
| --- | --- |
| Disallow property access `._id` | All application files except allowlisted persistence files |
| Disallow string literals `idField: '_id'` | Entire application source |
| Disallow types containing `_id?:` in non-model, non-migration files | Entire application source |

### Allowlist

| Allowed path pattern |
| --- |
| `apps/core/src/**/migration/**` |
| `apps/core/src/**/model.ts` |
| `apps/core/src/shared/model/**` |
| `apps/core/src/**/schema.ts` when defining Mongoose schema shape |
| Explicit query-boundary helpers under `apps/core/src/shared/id/**` |

## API and Package Surface Changes

### Core API

| Surface | Breaking change |
| --- | --- |
| HTTP JSON | `_id` removed everywhere |
| WebSocket entity payloads | `_id` removed everywhere |
| Internal business event payloads | Full documents removed; typed `{ id }` only |

### `packages/api-client`

`packages/api-client/models/base.ts` already models `id` only. This refactor aligns the server with the client contract. Any tests that still rely on `_id` fixtures at the transport layer must be updated.

### `packages/webhook`

Generated model extraction must be verified after the refactor so that generated types do not regress to `_id`-dependent transport contracts.

## Breaking Change and Rollout Strategy

### Release Strategy

| Property | Decision |
| --- | --- |
| Rollout mode | Single cutover |
| Compatibility shims | None |
| Feature flags | None |
| Required coordination | Core server, WebSocket consumers, tests, generated types |

### Data Migration

No database data migration is required because MongoDB continues to store `_id` as usual. This is an application contract refactor, not a persistence rewrite.

## Test Plan

### Unit Tests

| Area | Required assertions |
| --- | --- |
| Shared ID utils | Valid ID branding, invalid ID rejection, `toObjectId` conversion |
| Lean normalization plugin | Root object, nested object, populated object, array recursion, `_id` removal |
| Base model serialization | `toJSON()` and `toObject()` expose `id` and omit `_id` |
| Translation interceptor | Entity lookup uses `id` only |
| Search document builder | `refId` derives from `id` only |

### Integration Tests

| Area | Required assertions |
| --- | --- |
| CRUD endpoints | Response payloads contain `id` and never `_id` |
| Create/update/delete events | Event payloads are `{ id }` only |
| Translation flows | Article and entity translation handlers work without `_id` fallback |
| Activity and aggregate endpoints | Nested refs expose `id` only |
| Comment flows | Comment lifecycle and reply flows operate without `(comment as any)._id` access |

### Static Verification

| Check | Purpose |
| --- | --- |
| `tsc --noEmit` | Type contract enforcement |
| ESLint | `_id` usage policy enforcement |
| Targeted Vitest suites | Regression coverage for touched modules |

### Test Design Constraints

Follow the repository policy:

| Constraint | Requirement |
| --- | --- |
| Snapshot tests | Do not add implementation snapshots of static tables or literal structures |
| Behavioral coverage | Prefer assertions on canonical `id` visibility and absence of `_id` |

## Implementation Sequence

```text
┌────────────────────────────┐
│ 1. Shared ID module        │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ 2. Base serialization and  │
│    recursive lean plugin   │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ 3. DTO and event typing    │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ 4. Controller/service      │
│    fallback removal        │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ 5. Translation/search/     │
│    owner/recently cleanup  │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ 6. Lint rule + tests       │
└────────────────────────────┘
```

## Acceptance Criteria

| Criterion | Pass condition |
| --- | --- |
| Canonical transport | No HTTP or WebSocket payload contains `_id` |
| Canonical event model | No lifecycle event consumer needs `_id` fallback logic |
| Type safety | No business-layer signature accepts `string \| Types.ObjectId` |
| Translation consistency | All `TranslateFields` rules use `idField: 'id'` |
| Static enforcement | ESLint fails on newly introduced `_id` access outside allowlist |
| Runtime consistency | Populated nested objects expose `id` recursively |

## Explicit Rejection List

The following patterns are prohibited after this refactor:

```ts
doc.id ?? doc._id?.toString?.()
event?.id?.toString?.() ?? event?._id?.toString?.()
type X = { id?: string; _id?: unknown }
type Y = string | Types.ObjectId
@TranslateFields({ path: 'topic.name', keyPath: 'topic.name', idField: '_id' })
```

These are not transitional code smells. They are direct violations of the target architecture.
