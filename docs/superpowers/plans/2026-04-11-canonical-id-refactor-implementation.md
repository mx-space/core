# Canonical String ID Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all application-layer `_id` usage with a single canonical `id: ObjectIdString` contract, remove all compatibility fallbacks, and enforce the new model through types, serialization, events, tests, and lint rules.

**Architecture:** Introduce a branded shared ID module that owns all `ObjectIdString <-> Types.ObjectId` conversion. Rebuild serialization and lean normalization so all documents, including nested populated objects, expose only `id`. Standardize lifecycle events to typed `{ id }` payloads, then sweep controllers, services, and utilities so business logic never sees `_id` or mixed identifier unions.

**Tech Stack:** NestJS, TypeGoose/Mongoose, Zod (`nestjs-zod`), Vitest, pnpm, ESLint

---

## Spec Reference

| Document | Purpose |
| --- | --- |
| `docs/superpowers/specs/2026-04-11-canonical-id-refactor-design.md` | Authoritative architecture and breaking-change contract |

## Phase Map

| Phase | Objective | Primary verification |
| --- | --- | --- |
| Phase 1 | Shared branded ID primitives and DTO boundary | Shared ID unit tests, `typecheck` |
| Phase 2 | Canonical serialization, lean normalization, typed lifecycle events | Lean/plugin tests, CRUD/event tests |
| Phase 3 | Translation and article controller refactor | Translation interceptor tests, note/post/page controller tests |
| Phase 4 | Consumer sweep for activity, aggregate, search, owner, recently, serverless, comment | Module-specific Vitest suites |
| Phase 5 | Static enforcement and release verification | ESLint, TypeScript, targeted regression matrix |

## File Map

| Action | File | Responsibility |
| --- | --- | --- |
| Create | `apps/core/src/shared/id/id.type.ts` | Branded `ObjectIdString` and entity ID aliases |
| Create | `apps/core/src/shared/id/id.schema.ts` | Zod branded object ID schema |
| Create | `apps/core/src/shared/id/id.util.ts` | Canonical parse/brand/`toObjectId` helpers |
| Create | `apps/core/src/shared/id/index.ts` | Shared exports |
| Modify | `apps/core/src/common/zod/primitives.ts` | Re-export branded object ID schema or upgrade `zMongoId` |
| Modify | `apps/core/src/common/zod/index.ts` | Shared branded schema export |
| Modify | `apps/core/src/shared/dto/id.dto.ts` | DTOs return branded IDs |
| Modify | `apps/core/src/shared/dto/pager.dto.ts` | Cursor IDs use branded type |
| Modify | `apps/core/src/shared/model/base.model.ts` | Canonical `id` typing and serialization |
| Modify | `apps/core/src/shared/model/plugins/lean-id.ts` | Recursive normalization; strip `_id` |
| Create | `apps/core/src/processors/helper/helper.event.types.ts` | Typed event payload map |
| Modify | `apps/core/src/processors/helper/helper.event.service.ts` | Generic typed emit/on/register interfaces |
| Modify | `apps/core/src/transformers/crud-factor.transformer.ts` | Emit typed `{ id }` lifecycle payloads only |
| Modify | `apps/core/src/processors/helper/helper.event-payload.service.ts` | Enrich payloads by `id` only |
| Modify | `apps/core/src/processors/gateway/web/visitor-event-dispatch.service.ts` | Remove `_id` fallbacks from visitor broadcasting |
| Modify | `apps/core/src/common/decorators/translate-fields.decorator.ts` | Restrict `idField` to `'id'` |
| Modify | `apps/core/src/common/interceptors/translation-entry.interceptor.ts` | Collect and replace entity translations by `id` only |
| Modify | `apps/core/src/modules/ai/ai-translation/ai-translation.types.ts` | Remove mixed `_id`-based event payload types |
| Modify | `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts` | Remove fallback extraction logic |
| Modify | `apps/core/src/modules/ai/ai-translation/ai-translation-event-handler.service.ts` | Consume canonical typed event payloads |
| Modify | `apps/core/src/modules/page/page.controller.ts` | Remove `doc._id` fallbacks |
| Modify | `apps/core/src/modules/note/note.controller.ts` | Remove `note._id` fallbacks |
| Modify | `apps/core/src/modules/post/post.controller.ts` | Remove `doc._id` fallbacks |
| Modify | `apps/core/src/modules/activity/activity.controller.ts` | Remove `_id` response assembly and translation fallback logic |
| Modify | `apps/core/src/modules/activity/activity.service.ts` | Build maps by canonical `id` |
| Modify | `apps/core/src/modules/aggregate/aggregate.controller.ts` | Remove `_id` fallback response shaping |
| Modify | `apps/core/src/modules/topic/topic.controller.ts` | Switch translation rules to `idField: 'id'` |
| Modify | `apps/core/src/modules/category/category.controller.ts` | Switch translation rules to `idField: 'id'` |
| Modify | `apps/core/src/modules/search/search-document.util.ts` | Build search refs from `id` only |
| Modify | `apps/core/src/modules/search/search.service.ts` | Canonical search source/result typing |
| Modify | `apps/core/src/modules/owner/owner.model.ts` | Remove `_id` from view model contract |
| Modify | `apps/core/src/modules/owner/owner.service.ts` | Return owner identity with `id` only |
| Modify | `apps/core/src/modules/recently/recently.model.ts` | Canonical `refId` getter semantics |
| Modify | `apps/core/src/modules/recently/recently.service.ts` | Keep query boundary conversion local; expose `id` only |
| Modify | `apps/core/src/modules/serverless/serverless.service.ts` | Remove owner `_id` fallbacks from returned identities |
| Modify | `apps/core/src/modules/markdown/markdown.service.ts` | Return category-like objects with canonical `id` |
| Modify | `apps/core/src/modules/comment/comment.service.ts` | Replace local mixed-ID helpers with shared canonical helpers |
| Modify | `apps/core/src/modules/comment/comment.lifecycle.service.ts` | Remove `(comment as any)._id` access |
| Modify | `apps/core/src/modules/comment/comment.controller.ts` | Remove fallback response assembly |
| Modify | `eslint.config.mjs` | Add `_id` restriction policy outside allowlist |
| Create | `apps/core/test/src/shared/id/id.util.spec.ts` | Shared ID boundary tests |
| Create | `apps/core/test/src/shared/model/lean-id.spec.ts` | Recursive serialization and lean normalization tests |
| Create | `apps/core/test/src/processors/helper/helper.event.service.spec.ts` | Typed lifecycle payload tests |
| Create | `apps/core/test/src/modules/page/page.controller.spec.ts` | Page controller canonical `id` translation tests |
| Create | `apps/core/test/src/modules/activity/activity.controller.spec.ts` | Activity controller `id`-only response tests |
| Create | `apps/core/test/src/modules/aggregate/aggregate.controller.spec.ts` | Aggregate controller `id`-only response tests |
| Modify | `apps/core/test/src/transformers/curd-factor.e2e-spec.ts` | CRUD lifecycle payload contract |
| Modify | `apps/core/test/src/modules/ai/translation-entry.interceptor.spec.ts` | `idField: 'id'` translation lookup behavior |
| Modify | `apps/core/test/src/modules/ai/ai-translation.service.spec.ts` | Canonical article event ID handling |
| Modify | `apps/core/test/src/modules/note/note.translation-entry.e2e-spec.ts` | Nested translated refs use `id` |
| Modify | `apps/core/test/src/modules/topic/topic.controller.e2e-spec.ts` | Topic translation rules use `id` |
| Modify | `apps/core/test/src/modules/note/note.controller.e2e-spec.ts` | No `_id` in note transport shape |
| Modify | `apps/core/test/src/modules/post/post.controller.e2e-spec.ts` | No `_id` in post transport shape |
| Modify | `apps/core/test/src/modules/search/search-document.util.spec.ts` | Search document builder rejects `_id`-only fixtures |
| Modify | `apps/core/test/src/modules/search/search.service.spec.ts` | Search aggregation uses canonical IDs |
| Modify | `apps/core/test/src/modules/owner/owner.controller.spec.ts` | Owner response has `id` only |
| Modify | `apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts` | Recently responses and refs expose `id` only |
| Modify | `apps/core/test/src/modules/serverless/serverless.service.spec.ts` | Serverless owner identity uses `id` only |
| Modify | `apps/core/test/src/modules/comment/comment-write.spec.ts` | Comment writes use shared canonical IDs |
| Modify | `apps/core/test/src/modules/comment/comment-thread.spec.ts` | Thread loading and root resolution use `id` only |
| Modify | `apps/core/test/src/modules/comment/comment-lifecycle.spec.ts` | Lifecycle broadcasting uses `id` only |
| Modify | `apps/core/test/src/modules/comment/comment.controller.spec.ts` | Comment responses expose `id` only |

---

## Phase 1: Shared ID Foundation

### Task 1: Create the shared branded ID module

**Files:**
- Create: `apps/core/src/shared/id/id.type.ts`
- Create: `apps/core/src/shared/id/id.schema.ts`
- Create: `apps/core/src/shared/id/id.util.ts`
- Create: `apps/core/src/shared/id/index.ts`
- Test: `apps/core/test/src/shared/id/id.util.spec.ts`

- [ ] **Step 1: Write the failing shared ID tests**

Add tests covering:
- valid 24-hex strings are branded as `ObjectIdString`
- invalid strings are rejected
- `toObjectId` converts branded IDs to `Types.ObjectId`
- entity branding helpers preserve the original value

Suggested skeleton:

```ts
it('brands valid object id strings')
it('rejects invalid object id strings')
it('converts branded ids to Types.ObjectId')
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/shared/id/id.util.spec.ts`

Expected: FAIL because the shared ID module does not exist.

- [ ] **Step 3: Implement the shared ID module**

Create the branded types and boundary helpers described in the spec:

```ts
export type ObjectIdString = string & { readonly [objectIdBrand]: 'ObjectIdString' }
export const zObjectIdString = z.string().regex(...).transform(...)
export function toObjectId(id: ObjectIdString): Types.ObjectId
```

- [ ] **Step 4: Re-run the targeted test to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/shared/id/id.util.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/shared/id apps/core/test/src/shared/id/id.util.spec.ts
git commit -m "refactor(id): add canonical branded id primitives"
```

### Task 2: Upgrade Zod and shared DTO boundaries to branded IDs

**Files:**
- Modify: `apps/core/src/common/zod/primitives.ts`
- Modify: `apps/core/src/common/zod/index.ts`
- Modify: `apps/core/src/shared/dto/id.dto.ts`
- Modify: `apps/core/src/shared/dto/pager.dto.ts`
- Test: `apps/core/test/src/shared/id/id.util.spec.ts`

- [ ] **Step 1: Extend tests to cover DTO-facing branding**

Add assertions that:
- `MongoIdDto`-compatible parsing returns `ObjectIdString`
- `IntIdOrMongoIdDto` still permits integer IDs where route semantics require it
- pager `before/after` values are branded IDs

- [ ] **Step 2: Run targeted tests and typecheck to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/shared/id/id.util.spec.ts`

Run: `pnpm -C apps/core run typecheck`

Expected: FAIL or TYPECHECK errors because DTOs still expose plain strings.

- [ ] **Step 3: Refactor Zod exports and DTOs**

Update:
- `zMongoId` to return a branded type or alias it to `zObjectIdString`
- `MongoIdDto.id` to use `ObjectIdString`
- `IntIdOrMongoIdDto.id` to use `number | ObjectIdString`
- `PagerDto.before/after` to use branded IDs

- [ ] **Step 4: Re-run tests and typecheck to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/shared/id/id.util.spec.ts`

Run: `pnpm -C apps/core run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/common/zod/primitives.ts apps/core/src/common/zod/index.ts apps/core/src/shared/dto/id.dto.ts apps/core/src/shared/dto/pager.dto.ts apps/core/test/src/shared/id/id.util.spec.ts
git commit -m "refactor(id): brand dto and zod id boundaries"
```

---

## Phase 2: Canonical Serialization and Typed Events

### Task 3: Rebuild base serialization and recursive lean normalization

**Files:**
- Modify: `apps/core/src/shared/model/base.model.ts`
- Modify: `apps/core/src/shared/model/plugins/lean-id.ts`
- Test: `apps/core/test/src/shared/model/lean-id.spec.ts`

- [ ] **Step 1: Write the failing serialization tests**

Add tests covering:
- `toJSON()` exposes `id` and omits `_id`
- `toObject()` exposes `id` and omits `_id`
- nested populated objects are normalized recursively
- arrays of nested populated objects are normalized recursively

Suggested skeleton:

```ts
expect(serialized).toEqual({
  id: expect.any(String),
  child: { id: expect.any(String) },
})
expect(serialized).not.toHaveProperty('_id')
expect(serialized.child).not.toHaveProperty('_id')
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/shared/model/lean-id.spec.ts`

Expected: FAIL because `_id` is still present and nested objects are not normalized.

- [ ] **Step 3: Implement canonical serialization**

Refactor:
- `BaseModel.id` to `ObjectIdString`
- base serialization hooks to delete `_id`
- recursive lean normalizer to rewrite nested documents from `_id` to `id`

- [ ] **Step 4: Re-run the targeted test to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/shared/model/lean-id.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/shared/model/base.model.ts apps/core/src/shared/model/plugins/lean-id.ts apps/core/test/src/shared/model/lean-id.spec.ts
git commit -m "refactor(id): canonicalize model serialization and lean results"
```

### Task 4: Verify CRUD transport emits `id` only

**Files:**
- Modify: `apps/core/test/src/transformers/curd-factor.e2e-spec.ts`
- Modify: `apps/core/src/transformers/crud-factor.transformer.ts`

- [ ] **Step 1: Write the failing CRUD transport assertions**

Add assertions that:
- CRUD create/update/get responses include `id`
- CRUD responses do not include `_id`
- delete lifecycle payload carries `{ id }` only

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/transformers/curd-factor.e2e-spec.ts`

Expected: FAIL because transport still leaks `_id` and lifecycle payloads are inconsistent.

- [ ] **Step 3: Refactor CRUD factory output and lifecycle emission**

Update `crud-factor.transformer.ts` so:
- create/update/delete broadcasts are typed `{ id }`
- no raw document is emitted as a lifecycle payload

- [ ] **Step 4: Re-run the targeted test to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/transformers/curd-factor.e2e-spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/transformers/crud-factor.transformer.ts apps/core/test/src/transformers/curd-factor.e2e-spec.ts
git commit -m "refactor(id): standardize crud transport and lifecycle payloads"
```

### Task 5: Add typed event payload contracts and update event infrastructure

**Files:**
- Create: `apps/core/src/processors/helper/helper.event.types.ts`
- Modify: `apps/core/src/processors/helper/helper.event.service.ts`
- Modify: `apps/core/src/processors/helper/helper.event-payload.service.ts`
- Modify: `apps/core/src/processors/gateway/web/visitor-event-dispatch.service.ts`
- Create: `apps/core/test/src/processors/helper/helper.event.service.spec.ts`

- [ ] **Step 1: Write the failing event payload tests**

Add tests covering:
- `emit/on/registerHandler` are type-safe for lifecycle payloads
- payload enrichment reloads entities from `id`
- visitor event translation broadcasting never inspects `_id`

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/processors/helper/helper.event.service.spec.ts`

Expected: FAIL because typed event payload infrastructure does not exist.

- [ ] **Step 3: Implement typed event contracts**

Create a payload map such as:

```ts
export interface BusinessEventPayloadMap {
  POST_CREATE: { id: PostId }
  POST_UPDATE: { id: PostId }
  NOTE_CREATE: { id: NoteId }
  COMMENT_CREATE: { id: CommentId }
}
```

Then refactor:
- `EventManagerService.emit/on/registerHandler`
- `EventPayloadEnricherService`
- `VisitorEventDispatchService`

to use canonical typed payloads.

- [ ] **Step 4: Re-run the targeted test to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/processors/helper/helper.event.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/processors/helper/helper.event.types.ts apps/core/src/processors/helper/helper.event.service.ts apps/core/src/processors/helper/helper.event-payload.service.ts apps/core/src/processors/gateway/web/visitor-event-dispatch.service.ts apps/core/test/src/processors/helper/helper.event.service.spec.ts
git commit -m "refactor(id): type lifecycle events around canonical ids"
```

---

## Phase 3: Translation and Article Flow Refactor

### Task 6: Remove mixed `_id` event payload support from AI translation flows

**Files:**
- Modify: `apps/core/src/modules/ai/ai-translation/ai-translation.types.ts`
- Modify: `apps/core/src/modules/ai/ai-translation/ai-translation.service.ts`
- Modify: `apps/core/src/modules/ai/ai-translation/ai-translation-event-handler.service.ts`
- Modify: `apps/core/test/src/modules/ai/ai-translation.service.spec.ts`

- [ ] **Step 1: Write the failing translation event tests**

Add assertions that:
- article event payloads are `{ id }` only
- translation service no longer accepts `{ data }` or document-shaped payloads with `_id`
- delete/update/create handlers reload the entity by `id`

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/ai-translation.service.spec.ts`

Expected: FAIL because the translation service still contains fallback extraction logic.

- [ ] **Step 3: Refactor AI translation event types and handlers**

Remove:
- `_id`-based `ArticleEventDocument`
- `extractIdFromEvent` compatibility logic
- any `event?.id?.toString?.() ?? event?._id?.toString?.()` patterns

Replace with typed `id` payload handling only.

- [ ] **Step 4: Re-run the targeted test to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/ai-translation.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/ai/ai-translation/ai-translation.types.ts apps/core/src/modules/ai/ai-translation/ai-translation.service.ts apps/core/src/modules/ai/ai-translation/ai-translation-event-handler.service.ts apps/core/test/src/modules/ai/ai-translation.service.spec.ts
git commit -m "refactor(id): remove mixed id payload support from translation flows"
```

### Task 7: Narrow translation decorators and interceptor to `idField: 'id'`

**Files:**
- Modify: `apps/core/src/common/decorators/translate-fields.decorator.ts`
- Modify: `apps/core/src/common/interceptors/translation-entry.interceptor.ts`
- Modify: `apps/core/src/modules/post/post.controller.ts`
- Modify: `apps/core/src/modules/note/note.controller.ts`
- Modify: `apps/core/src/modules/topic/topic.controller.ts`
- Modify: `apps/core/src/modules/category/category.controller.ts`
- Modify: `apps/core/test/src/modules/ai/translation-entry.interceptor.spec.ts`
- Modify: `apps/core/test/src/modules/note/note.translation-entry.e2e-spec.ts`
- Modify: `apps/core/test/src/modules/topic/topic.controller.e2e-spec.ts`

- [ ] **Step 1: Write the failing translation-entry tests**

Add assertions that:
- `TranslateFieldRule.idField` only accepts `'id'`
- translation lookups pull `parent.id`, not `parent._id`
- nested translated refs continue to resolve correctly after recursive normalization

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/translation-entry.interceptor.spec.ts test/src/modules/note/note.translation-entry.e2e-spec.ts test/src/modules/topic/topic.controller.e2e-spec.ts`

Expected: FAIL because the decorator and tests still depend on `_id`.

- [ ] **Step 3: Refactor decorator contract and call sites**

Change:

```ts
export interface TranslateFieldRule {
  path: string
  keyPath: TranslationEntryKeyPath
  idField?: 'id'
}
```

Then update every call site from `idField: '_id'` to `idField: 'id'`.

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/ai/translation-entry.interceptor.spec.ts test/src/modules/note/note.translation-entry.e2e-spec.ts test/src/modules/topic/topic.controller.e2e-spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/common/decorators/translate-fields.decorator.ts apps/core/src/common/interceptors/translation-entry.interceptor.ts apps/core/src/modules/post/post.controller.ts apps/core/src/modules/note/note.controller.ts apps/core/src/modules/topic/topic.controller.ts apps/core/src/modules/category/category.controller.ts apps/core/test/src/modules/ai/translation-entry.interceptor.spec.ts apps/core/test/src/modules/note/note.translation-entry.e2e-spec.ts apps/core/test/src/modules/topic/topic.controller.e2e-spec.ts
git commit -m "refactor(id): translate entity fields by canonical id"
```

### Task 8: Remove article controller `_id` fallbacks in page, note, and post flows

**Files:**
- Create: `apps/core/test/src/modules/page/page.controller.spec.ts`
- Modify: `apps/core/src/modules/page/page.controller.ts`
- Modify: `apps/core/src/modules/note/note.controller.ts`
- Modify: `apps/core/src/modules/post/post.controller.ts`
- Modify: `apps/core/test/src/modules/note/note.controller.e2e-spec.ts`
- Modify: `apps/core/test/src/modules/post/post.controller.e2e-spec.ts`

- [ ] **Step 1: Write the failing article controller tests**

Add assertions that:
- article translation input uses `doc.id` only
- note adjacency translation uses `note.id`
- responses contain `id` and omit `_id`
- page translation routes operate correctly with canonical `id`

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/page/page.controller.spec.ts test/src/modules/note/note.controller.e2e-spec.ts test/src/modules/post/post.controller.e2e-spec.ts`

Expected: FAIL because controllers still use `_id` fallback expressions.

- [ ] **Step 3: Refactor article controllers**

Replace all patterns such as:

```ts
doc._id?.toString?.() ?? doc.id ?? String(doc._id)
```

with direct canonical reads:

```ts
doc.id
```

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/page/page.controller.spec.ts test/src/modules/note/note.controller.e2e-spec.ts test/src/modules/post/post.controller.e2e-spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/page/page.controller.ts apps/core/src/modules/note/note.controller.ts apps/core/src/modules/post/post.controller.ts apps/core/test/src/modules/page/page.controller.spec.ts apps/core/test/src/modules/note/note.controller.e2e-spec.ts apps/core/test/src/modules/post/post.controller.e2e-spec.ts
git commit -m "refactor(id): remove article controller id fallbacks"
```

---

## Phase 4: Consumer Sweep

### Task 9: Refactor activity, aggregate, category, and topic consumers to canonical IDs

**Files:**
- Create: `apps/core/test/src/modules/activity/activity.controller.spec.ts`
- Create: `apps/core/test/src/modules/aggregate/aggregate.controller.spec.ts`
- Modify: `apps/core/src/modules/activity/activity.controller.ts`
- Modify: `apps/core/src/modules/activity/activity.service.ts`
- Modify: `apps/core/src/modules/aggregate/aggregate.controller.ts`
- Modify: `apps/core/src/modules/category/category.controller.ts`
- Modify: `apps/core/src/modules/topic/topic.controller.ts`
- Modify: `apps/core/test/src/modules/topic/topic.controller.e2e-spec.ts`

- [ ] **Step 1: Write the failing consumer-facing controller tests**

Add assertions that:
- presence/read-room/top-reading endpoints expose nested refs with `id` only
- aggregate summaries do not synthesize `id` from `_id`
- topic/category translation paths still work after removing `_id`

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/activity/activity.controller.spec.ts test/src/modules/aggregate/aggregate.controller.spec.ts test/src/modules/topic/topic.controller.e2e-spec.ts`

Expected: FAIL because controllers and services still reference `_id`.

- [ ] **Step 3: Refactor activity and aggregate flows**

Remove all `_id` response assembly from:
- `activity.controller.ts`
- `activity.service.ts`
- `aggregate.controller.ts`

Require every translation input and response projection to use canonical `id`.

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/activity/activity.controller.spec.ts test/src/modules/aggregate/aggregate.controller.spec.ts test/src/modules/topic/topic.controller.e2e-spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/activity/activity.controller.ts apps/core/src/modules/activity/activity.service.ts apps/core/src/modules/aggregate/aggregate.controller.ts apps/core/src/modules/category/category.controller.ts apps/core/src/modules/topic/topic.controller.ts apps/core/test/src/modules/activity/activity.controller.spec.ts apps/core/test/src/modules/aggregate/aggregate.controller.spec.ts apps/core/test/src/modules/topic/topic.controller.e2e-spec.ts
git commit -m "refactor(id): canonicalize aggregate and activity consumers"
```

### Task 10: Refactor search, owner, recently, serverless, and markdown support code

**Files:**
- Modify: `apps/core/src/modules/search/search-document.util.ts`
- Modify: `apps/core/src/modules/search/search.service.ts`
- Modify: `apps/core/src/modules/owner/owner.model.ts`
- Modify: `apps/core/src/modules/owner/owner.service.ts`
- Modify: `apps/core/src/modules/recently/recently.model.ts`
- Modify: `apps/core/src/modules/recently/recently.service.ts`
- Modify: `apps/core/src/modules/serverless/serverless.service.ts`
- Modify: `apps/core/src/modules/markdown/markdown.service.ts`
- Modify: `apps/core/test/src/modules/search/search-document.util.spec.ts`
- Modify: `apps/core/test/src/modules/search/search.service.spec.ts`
- Modify: `apps/core/test/src/modules/owner/owner.controller.spec.ts`
- Modify: `apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts`
- Modify: `apps/core/test/src/modules/serverless/serverless.service.spec.ts`

- [ ] **Step 1: Write the failing support-layer tests**

Add assertions that:
- search document builders require `id`
- owner responses do not carry `_id`
- recently refs resolve to canonical `id`
- serverless owner identity only carries `id`
- markdown category helpers return canonical IDs

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/search/search-document.util.spec.ts test/src/modules/search/search.service.spec.ts test/src/modules/owner/owner.controller.spec.ts test/src/modules/recently/recently.controller.e2e-spec.ts test/src/modules/serverless/serverless.service.spec.ts`

Expected: FAIL because utility and view contracts still reference `_id`.

- [ ] **Step 3: Refactor support modules**

Implement the following:
- remove `_id` from `OwnerModel`
- require `SearchDocumentSource.id`
- update `RecentlyModel.refId` getter to resolve from populated `id`
- stop returning owner `_id` from serverless flows
- stop returning category `_id` from markdown helpers

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/search/search-document.util.spec.ts test/src/modules/search/search.service.spec.ts test/src/modules/owner/owner.controller.spec.ts test/src/modules/recently/recently.controller.e2e-spec.ts test/src/modules/serverless/serverless.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/search/search-document.util.ts apps/core/src/modules/search/search.service.ts apps/core/src/modules/owner/owner.model.ts apps/core/src/modules/owner/owner.service.ts apps/core/src/modules/recently/recently.model.ts apps/core/src/modules/recently/recently.service.ts apps/core/src/modules/serverless/serverless.service.ts apps/core/src/modules/markdown/markdown.service.ts apps/core/test/src/modules/search/search-document.util.spec.ts apps/core/test/src/modules/search/search.service.spec.ts apps/core/test/src/modules/owner/owner.controller.spec.ts apps/core/test/src/modules/recently/recently.controller.e2e-spec.ts apps/core/test/src/modules/serverless/serverless.service.spec.ts
git commit -m "refactor(id): remove _id from support-layer contracts"
```

### Task 11: Refactor the comment module to use canonical IDs only

**Files:**
- Modify: `apps/core/src/modules/comment/comment.service.ts`
- Modify: `apps/core/src/modules/comment/comment.lifecycle.service.ts`
- Modify: `apps/core/src/modules/comment/comment.controller.ts`
- Modify: `apps/core/test/src/modules/comment/comment-write.spec.ts`
- Modify: `apps/core/test/src/modules/comment/comment-thread.spec.ts`
- Modify: `apps/core/test/src/modules/comment/comment-lifecycle.spec.ts`
- Modify: `apps/core/test/src/modules/comment/comment.controller.spec.ts`
- Modify: `apps/core/test/src/modules/comment/comment-anchor.spec.ts`

- [ ] **Step 1: Write the failing comment module tests**

Add assertions that:
- comment service does not define local mixed-ID unions
- thread/root lookup logic works from canonical `id`
- lifecycle broadcasting sends `{ id }`
- controller responses expose `id` only

- [ ] **Step 2: Run the targeted tests to verify RED**

Run: `pnpm -C apps/core exec vitest run test/src/modules/comment/comment-write.spec.ts test/src/modules/comment/comment-thread.spec.ts test/src/modules/comment/comment-lifecycle.spec.ts test/src/modules/comment/comment.controller.spec.ts test/src/modules/comment/comment-anchor.spec.ts`

Expected: FAIL because comment code still relies on `_id` and mixed ID helpers.

- [ ] **Step 3: Refactor comment ID handling**

Replace local helper patterns such as:

```ts
private toObjectId(id: string | Types.ObjectId | { _id?: unknown })
private buildMixedIdCandidates(ids: Array<string | Types.ObjectId | ...>)
```

with shared branded boundary conversions. All internal identity comparisons must use canonical `id`.

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**

Run: `pnpm -C apps/core exec vitest run test/src/modules/comment/comment-write.spec.ts test/src/modules/comment/comment-thread.spec.ts test/src/modules/comment/comment-lifecycle.spec.ts test/src/modules/comment/comment.controller.spec.ts test/src/modules/comment/comment-anchor.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/comment/comment.service.ts apps/core/src/modules/comment/comment.lifecycle.service.ts apps/core/src/modules/comment/comment.controller.ts apps/core/test/src/modules/comment/comment-write.spec.ts apps/core/test/src/modules/comment/comment-thread.spec.ts apps/core/test/src/modules/comment/comment-lifecycle.spec.ts apps/core/test/src/modules/comment/comment.controller.spec.ts apps/core/test/src/modules/comment/comment-anchor.spec.ts
git commit -m "refactor(id): canonicalize comment module identifiers"
```

---

## Phase 5: Enforcement and Release Verification

### Task 12: Add lint enforcement and sweep residual `_id` leaks

**Files:**
- Modify: `eslint.config.mjs`
- Modify: any remaining violating source files discovered by lint

- [ ] **Step 1: Add restricted `_id` usage rules**

Configure ESLint to:
- disallow `._id` property access outside the approved allowlist
- disallow `idField: '_id'`
- disallow non-model `_id?:` utility types in application code

- [ ] **Step 2: Run lint to verify RED**

Run: `pnpm exec eslint "apps/core/src/**/*.ts" "packages/**/*.ts"`

Expected: FAIL with residual `_id` violations outside the allowlist.

- [ ] **Step 3: Fix all remaining violations**

Use the lint output as a checklist. Do not weaken the rule. Eliminate or relocate every remaining illegal `_id` usage.

- [ ] **Step 4: Re-run lint to verify GREEN**

Run: `pnpm exec eslint "apps/core/src/**/*.ts" "packages/**/*.ts"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs apps/core/src packages
git commit -m "refactor(id): enforce canonical id usage with lint"
```

### Task 13: Run the full regression matrix and verify the breaking-change contract

**Files:**
- Modify: tests only if regressions remain

- [ ] **Step 1: Run the final targeted regression matrix**

Run:

```bash
pnpm -C apps/core exec vitest run \
  test/src/shared/id/id.util.spec.ts \
  test/src/shared/model/lean-id.spec.ts \
  test/src/processors/helper/helper.event.service.spec.ts \
  test/src/transformers/curd-factor.e2e-spec.ts \
  test/src/modules/ai/translation-entry.interceptor.spec.ts \
  test/src/modules/ai/ai-translation.service.spec.ts \
  test/src/modules/page/page.controller.spec.ts \
  test/src/modules/note/note.controller.e2e-spec.ts \
  test/src/modules/post/post.controller.e2e-spec.ts \
  test/src/modules/activity/activity.controller.spec.ts \
  test/src/modules/aggregate/aggregate.controller.spec.ts \
  test/src/modules/search/search-document.util.spec.ts \
  test/src/modules/search/search.service.spec.ts \
  test/src/modules/owner/owner.controller.spec.ts \
  test/src/modules/recently/recently.controller.e2e-spec.ts \
  test/src/modules/serverless/serverless.service.spec.ts \
  test/src/modules/comment/comment-write.spec.ts \
  test/src/modules/comment/comment-thread.spec.ts \
  test/src/modules/comment/comment-lifecycle.spec.ts \
  test/src/modules/comment/comment.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run static verification**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Run a contract grep for forbidden patterns**

Run:

```bash
rg -n "idField: '_id'|\\._id\\?\\.toString|\\?_id\\?\\.toString|event\\?\\._id|id \\?\\? .*_id|string \\| Types\\.ObjectId" apps/core/src packages
```

Expected: No matches outside migrations or explicit persistence allowlist files.

- [ ] **Step 4: Commit the completed refactor**

```bash
git add apps/core/src apps/core/test/src packages eslint.config.mjs
git commit -m "refactor(id): complete canonical string id migration"
```

- [ ] **Step 5: Prepare release notes**

Document the breaking changes:
- `_id` removed from transport payloads
- lifecycle events now carry `{ id }` only
- application code must use branded `ObjectIdString`

Suggested location: append to the current changelog or release notes workflow used by `apps/core/CHANGELOG.md`.

---

## Execution Notes

| Constraint | Instruction |
| --- | --- |
| Compatibility code | Do not introduce any adapter, shim, fallback chain, or dual-field payload |
| Query boundary | `Types.ObjectId` conversion is allowed only adjacent to model filters |
| Aggregation | Internal `_id` is allowed inside pipelines, but public results must project to `id` before returning |
| Tests | Prefer behavioral assertions on `id` presence and `_id` absence; avoid low-signal implementation snapshots |
| Review focus | Reject any implementation that leaves `string \| Types.ObjectId` unions in business-layer signatures |

## Completion Gate

The implementation is complete only when all of the following are true:

| Gate | Required state |
| --- | --- |
| Transport contract | HTTP and WebSocket payloads contain `id` and never `_id` |
| Event contract | Lifecycle events use typed `{ id }` payloads only |
| Type contract | No business-layer API accepts `string \| Types.ObjectId` |
| Translation contract | All `TranslateFields` rules use `idField: 'id'` |
| Static enforcement | ESLint blocks future `_id` leakage outside the allowlist |
| Regression matrix | All targeted tests, `pnpm typecheck`, and `pnpm lint` pass |

Plan complete and saved to `docs/superpowers/plans/2026-04-11-canonical-id-refactor-implementation.md`. Ready to execute?
