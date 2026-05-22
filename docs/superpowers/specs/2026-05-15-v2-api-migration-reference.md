# V2 API Migration — Reference Task List

**Companion to:** [`2026-05-15-v2-api-response-design.md`](./2026-05-15-v2-api-response-design.md)
**Date:** 2026-05-15
**Purpose:** Enumerate every module, file, and concern that the V2 response-layer refactor touches, organized into actionable tasks. Each task is sized to fit in a single PR.

This document is a **map**, not a plan. It catalogs the work; the order of execution and PR boundaries are decided in the implementation plan (writing-plans skill output).

## Scan Summary

- **45 modules** under `apps/core/src/modules/`
- **~55 controller files** across those modules (several modules expose multiple controllers — `ai/` has 8, `auth/` has 2, `option/` has 2, `file/` has 2, `snippet/` has 2), **~250+ endpoints**
- **Drizzle schemas:** centralized in `packages/db-schema/src/schema/` (not in `apps/core`)
- **Zod schemas:** distributed under `apps/core/src/modules/<mod>/<mod>.schema.ts`
- `@TranslateFields` decorator: **6 modules** — post, note, category, aggregate, topic, search
- `@HTTPDecorators.Bypass`: **22 controller files**, ~29 decorated endpoints
- `paginate()` / `listPaginated()`: post, note, page, draft, webhook, reader (via shared `PagerDto`)

## How to Read This Document

Each section is one **phase**. Inside a phase, each `### Task N.M` is one PR-sized unit of work. Tasks have:

- **Touches:** files/dirs to change
- **Deletes:** files/utilities removed
- **Notes:** module-specific gotchas
- **Depends on:** other tasks that must land first

A task may produce multiple commits but should be reviewable as one PR.

---

# Phase 0 — Infrastructure

New common machinery. No existing controllers change.

## Task 0.1: New `src/common/response/` foundation

**Touches:**

```
apps/core/src/common/response/
  envelope.types.ts            (NEW)
  meta.types.ts                (NEW)
  meta-builder.ts              (NEW)
  error.types.ts               (NEW)
  app-exception.filter.ts      (NEW)
  raw-response.decorator.ts    (NEW)
  response.interceptor.ts      (NEW — rewritten copy; old kept for now)
```

**Notes:**

- New interceptor `ResponseInterceptorV2` lives alongside the old; not yet wired into the global pipeline. Wired in Task 0.3.
- `AppException` extends `HttpException`. Define `PostNotFoundException`, `AuthSessionExpiredException`, etc. in their own modules (added per-module in Phase 2).
- `ResponseMetaSchema` keys: `pagination | view | translation | interaction | enrichments | related`. Sub-schemas (`PaginationSchema`, `ArticleTranslationSchema`, `EntryTranslationSchema`, `InteractionMetaSchema`, `EnrichmentEntrySchema`, `RelatedRefSchema`) live in `meta.types.ts`.
- `EnrichmentEntrySchema` mirrors the current `EnrichmentEntry` shape in `apps/core/src/modules/enrichment/`. Pull it across, do not redefine.
- `MetaObjectBuilder` accepts both `Map<id, T>` and `Record<id, T>` for the map-shaped meta keys; normalizes internally.

> ✅ **Design gaps resolved (2026-05-15).** The two design-spec inconsistencies below are now resolved — see `2026-05-15-v2-api-response-design.md` → "Resolved Decisions". This task can be planned against the current spec.
>
> 1. **`translation` meta shape → nested `{ article, fields }`.** `TranslationMetaSchema` is replaced by `ArticleTranslationSchema` (translated body) + `EntryTranslationSchema` (`{ article?, fields? }`). `ResponseMetaSchema.translation` is `EntryTranslation` (detail) or `Record<itemId, EntryTranslation>` (list); `EntryTranslationSchema`/`InteractionMetaSchema` are `.strict()` for union disambiguation. Task 2.1's "Meta concerns" (`translation.article`, `translation.fields[...]`) match this shape as-is.
> 2. **`meta.count` → carried in `data`.** Bulk-write responses return `{ data: { count, ids? } }`. `count` is not added to `ResponseMetaSchema`; the closed six-key set stands.

**Depends on:** —

## Task 0.2: Shared `View` helper types

**Touches:**

```
apps/core/src/common/views/
  view.types.ts                (NEW)
```

**Contents:**

- `type ViewDef<S extends z.ZodTypeAny> = S`
- `type ViewMap<TViews extends Record<string, z.ZodTypeAny>> = { ... }`
- `type ViewOf<TViews, K extends keyof TViews> = z.infer<TViews[K]>`
- Helper `parseView(view: K, viewMap, row)` for runtime parsing with friendly errors.

**Depends on:** 0.1

## Task 0.3: Wire `ResponseInterceptorV2` + `AppExceptionFilter` globally

**Touches:**

```
apps/core/src/app.module.ts                (or wherever APP_INTERCEPTOR/APP_FILTER tokens are wired)
```

**Notes:**

- Both the old `ResponseInterceptor` and the new `ResponseInterceptorV2` run for the **entire** transitional period — the old one cannot be removed until Phase 3 (Task 3.1) because un-migrated controllers still depend on it. New runs first.
- `ResponseInterceptorV2` is idempotent: it accepts both pre-wrapped `{ data, meta }` and bare values. To avoid double-wrap, confirm the old `ResponseInterceptor` passes an already-`{ data }`-shaped object through untouched (it only wraps bare arrays). If it does not, that fix belongs in this task.
- The safety net against double-wrap is the new interceptor's idempotence plus the E2E snapshot tests — not early removal of the old interceptor.
- `AppExceptionFilter` registered as global filter via `APP_FILTER`.

**Depends on:** 0.1, 0.2

## Task 0.4: Shared `PagerDto` rewrite

**Touches:**

```
apps/core/src/shared/dto/pager.dto.ts                  (REWRITE)
```

**Notes:**

- Replace current `PagerSchema` with a factory `createPagerSchema(sortKeys)` that returns a Zod schema with `page`, `size`, `view`, `sort_by`, `sort_order`, `year`.
- Keep `PagerDto` and `PagerSchema` exports for backwards compatibility during migration. Mark deprecated.
- All module-specific pagers (`PostPagerSchema`, `NoteQuerySchema`, `DraftPagerSchema`) will be migrated to the factory in Phase 2.

**Depends on:** 0.1

---

# Phase 1 — Schema-Layer snake_case

> Superseded. This phase was applied and then reversed. The schema layer and
> all business code are camelCase; `ResponseInterceptorV2` converts to
> snake_case at the wire boundary. See `§2` of the design spec. The Phase 1
> tasks below are kept only as a record of the original plan.

DB columns are already snake_case in the database. What changes is the **TS property name** on Drizzle column definitions, plus Zod DTO field names, plus every reference site.

## Task 1.1: `packages/db-schema/src/schema/columns.ts` rename helpers

**Touches:**

```
packages/db-schema/src/schema/columns.ts
```

**Notes:**

- Current helpers: `createdAt()`, `updatedAt()`, `tsCol()`, etc. Rename to `created_at()`, `updated_at()`, `ts_col()`.
- These helpers return a Drizzle column with mapping to the snake_case DB column. Rename the TS function names; the underlying SQL column names are unchanged.
- All importers in `packages/db-schema/src/schema/*.ts` update.

**Depends on:** —

## Task 1.2: `packages/db-schema/src/schema/*` rename TS prop names

**Touches:**

```
packages/db-schema/src/schema/ai.ts
packages/db-schema/src/schema/auth.ts
packages/db-schema/src/schema/content.ts        (categories, topics, posts, notes, pages, comments, drafts, ...)
packages/db-schema/src/schema/enrichment.ts
packages/db-schema/src/schema/migration.ts
packages/db-schema/src/schema/ops.ts
packages/db-schema/src/schema/search.ts
packages/db-schema/src/schema/index.ts
```

**Notes:**

- One PR per file is too granular; one PR per logical group is too coarse. Recommended: **one PR per schema file**.
- Inferred types (`InferSelectModel<typeof posts>`) auto-update.
- No SQL migration is required (the rename is TS-only). But run `pnpm -C apps/core run lint:migrations` and `pnpm -C apps/core run typecheck` after each file.
- ESLint rule `@typescript-eslint/naming-convention` may need adjustment to allow snake_case object keys.

**Depends on:** 1.1

## Task 1.3: Ripple rename to `apps/core` services / controllers / tests

**Touches:** the entire `apps/core/src/modules/` tree, plus `apps/core/test/`.

**Approach:**

- One PR per module (e.g., one for `post`, one for `note`). Smaller modules can be batched.
- Search-and-replace `\.createdAt\b` → `\.created_at\b`, etc., but verify by inspection — there are some genuine camelCase identifiers (variables, function names) that must NOT change.
- Update Zod DTO schemas in `apps/core/src/modules/<mod>/<mod>.schema.ts` to use snake_case keys.
- Each ripple PR includes regenerating any DTO-derived types and re-running affected tests.

**Phase 1.3 ↔ Phase 2 overlap:** This task and the Phase 2 controller rewrite touch the *same* controller/service files for a given module, in two separate passes. Two PRs per module doubles the diff surface and invites merge conflicts during the weeks the phases overlap. **Consider merging them per module** — one PR that does the snake_case rename *and* the V2 controller rewrite. The design spec (`§11`) keeps them split; the planner should decide explicitly. If kept split, finish a module's 1.3 before starting its Phase 2 task and never run the two concurrently.

**Depends on:** 1.2 (for the same schema file). Modules unblocked once their schema file is renamed.

## Task 1.4 — removed (folded into Task 3.1)

Deleting the case-conversion utilities (`case.util.ts`, `json-transform.interceptor.ts`) depends on **all of Phase 2** landing, so it is a Phase 3 task, not a Phase 1 one. Those deletions are already covered by **Task 3.1** — listing them here as well would delete the same files in two tasks. There is intentionally no separate Task 1.4.

---

# Phase 2 — Per-Module Migration

Each module's controller is rewritten to:

1. Return `{ data, meta? }` (or bare `T` for envelope auto-wrap).
2. Define `*.views.ts` with named views (`card`, `summary`, `detail`, or module-specific names).
3. Use `MetaObjectBuilder` for pagination, translation, interaction, enrichment, related.
4. Replace `@TranslateFields` decorator with explicit translation calls.
5. Replace `throw new HttpException` / `CannotFindException` with `AppException` subclasses bearing stable codes.
6. Replace per-module `PagerDto` with the shared factory.

Modules are grouped below by **migration weight** (rough effort estimate):

- **Heavy** — translation + paginate + complex meta. Expect a large PR.
- **Medium** — paginate or write-heavy, but no translation. Moderate PR.
- **Light** — few endpoints, mostly CRUD. Small PR.
- **Bypass-only** — non-JSON content. Only `@HTTPDecorators.Bypass` → `@RawResponse` rename plus exception handling.
- **Special** — auth, configs, or edge behavior; handled individually.

## Task 2.1 — Heavy module: `post`

**Touches:**

```
apps/core/src/modules/post/
  post.controller.ts        (10 endpoints, 364 LOC, 4× @TranslateFields, 2× paginate)
  post.service.ts
  post.schema.ts
  post.views.ts             (NEW)
  post.exceptions.ts        (NEW)
apps/core/test/src/modules/post/
  post.controller.spec.ts
```

**Endpoints to migrate:**

- `GET /` (list, paginated, `?select` to remove, `?view` introduced)
- `GET /:id`
- `GET /:category/:slug`
- `GET /latest`
- `GET /get-url/:slug`
- `POST /`
- `PATCH /:id`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/publish` (and similar admin actions)

**Views to define:**

- `card`: id, title, slug, summary, category, created_at, cover
- `summary`: card + tags, modified_at
- `detail`: full PostModel

**Meta concerns:**

- `translation.article` (detail) / `translation` map (list)
- `translation.fields['category.name']` for category translations
- `interaction.is_liked` (per-item map in list, single in detail)
- `enrichments` (detail only)
- `related` (detail only — translated titles already; now in `meta.related`)
- `pagination` (list)
- `view` (always)

**Removals:**

- `?select` query parameter handling (lines 107-124 of current controller)
- `applyContentPreference` call (let consumer choose)
- All `@TranslateFields` decorators
- In-line spread of `is_translated`, `translation_meta`, `is_liked` onto `doc`

**Exceptions:**

- `PostNotFoundException` (replaces `CannotFindException`)
- `PostUnpublishedException` (currently silently 404s for non-authenticated; consider explicit code)

**Depends on:** Phase 0, Task 1.3 for `post` module.

## Task 2.2 — Heavy module: `note`

**Touches:**

```
apps/core/src/modules/note/
  note.controller.ts        (13 endpoints, 803 LOC, 7× @TranslateFields, 1× paginate)
  note.service.ts
  note.schema.ts
  note.views.ts             (NEW)
  note.exceptions.ts        (NEW)
apps/core/test/src/modules/note/
  note.controller.spec.ts
```

**Notes:**

- Largest controller in the codebase (803 LOC). Consider extracting helpers (e.g., topic/related/translation orchestration) into separate files at the same time, since the file is already past the 500-line guidance.
- Note topic endpoints (`NoteTopicPagerDto`) — separate Zod schema, migrate to shared factory.
- Has the most diverse `@TranslateFields` paths (data[].topic, data[].related, etc.). Each must become an explicit translation call in the controller.

**Views:**

- `card`, `summary`, `detail`, plus `topic_summary` for topic-grouped listings.

**Exceptions:**

- `NoteNotFoundException`, `NotePasswordRequiredException` (current note has password-gated reads).

**Depends on:** Phase 0, Task 1.3 for `note` module.

## Task 2.3 — Heavy module: `page`

**Touches:**

```
apps/core/src/modules/page/
  page.controller.ts        (8 endpoints, 212 LOC, 1× paginate)
  page.service.ts
  page.schema.ts
  page.views.ts             (NEW)
  page.exceptions.ts        (NEW)
```

**Notes:**

- No `@TranslateFields` but uses `applyContentPreference` and likely some translation injection in `getPagesSummary`. Audit and migrate to meta.
- Views: `card`, `summary`, `detail`. Pages have unique field set (subtitle, order, etc.) — define explicitly.

**Depends on:** Phase 0, Task 1.3 for `page` module.

## Task 2.4 — Heavy module: `comment`

**Touches:**

```
apps/core/src/modules/comment/
  comment.controller.ts     (14 endpoints, 446 LOC, 0× translate, 0× paginate)
  comment.service.ts
  comment.schema.ts
  comment.views.ts          (NEW)
  comment.exceptions.ts     (NEW)
  comment.interceptor.ts    (audit — module-local interceptor, may merge into meta builder)
```

**Notes:**

- Comments have nested `replies` — decide if replies live in `data` (nested tree) or `meta.children` (flat with parent_id). Existing shape: nested tree. Keep nested for V2 unless YAGNI says otherwise.
- `comment.interceptor.ts` injects something — audit and migrate.
- Has its own filter logic for spam/moderation status; ensure error codes are stable.

**Views:** `card` (id, author, content, created_at), `detail` (with replies, source, ip masked).

**Exceptions:** `CommentNotFoundException`, `CommentSpamException`, `CommentNotAllowedException`.

**Depends on:** Phase 0, Task 1.3 for `comment` module.

## Task 2.5 — Heavy module: `aggregate`

**Touches:**

```
apps/core/src/modules/aggregate/
  aggregate.controller.ts   (17 endpoints, 379 LOC, 3× @TranslateFields)
  aggregate.service.ts
  aggregate.schema.ts
  aggregate.views.ts        (NEW)
```

**Notes:**

- Aggregate composes data from multiple resources (post + note + page + recent). Each sub-resource's view must be selected per call.
- Translation paths are deep (`data.posts[].category.name`, `data.notes[].topic.name`). Each becomes an explicit translation call; the orchestration of N parallel translations is non-trivial — consider helper service.
- Likely the trickiest controller after `note`. Plan extra time.

**Depends on:** Phase 0, Task 1.3, **AND** Tasks 2.1, 2.2, 2.3 (post/note/page must be migrated first since aggregate uses their views).

## Task 2.6 — Heavy module: `category`

**Touches:**

```
apps/core/src/modules/category/
  category.controller.ts    (6 endpoints, 207 LOC, 2× @TranslateFields)
  category.service.ts
  category.schema.ts
  category.views.ts         (NEW)
```

**Notes:**

- Categories embed posts in some endpoints. Decide nesting policy: include post `card` view, or `meta.related` with IDs.
- Translation: `category.name` only.

**Depends on:** Phase 0, Task 1.3.

## Task 2.7 — Medium: `topic`

**Touches:** `topic.controller.ts` (3 endpoints, 65 LOC, 3× @TranslateFields).

**Notes:** Similar to category — small but translation-heavy.

**Depends on:** Phase 0, Task 1.3.

## Task 2.8 — Medium: `search`

**Touches:** `search.controller.ts` (5 endpoints, 81 LOC, 2× @TranslateFields).

**Notes:** Search returns heterogeneous results (post/note/page). Use a discriminated union view (`{ type: 'post', data: ... } | { type: 'note', data: ... }`) or per-type pagination with `meta.type`.

**Depends on:** Phase 0, Task 1.3, 2.1-2.3.

## Task 2.9 — Medium: `draft`

**Touches:** `draft.controller.ts` (10 endpoints, 122 LOC, 1× paginate via DraftPagerDto).

**Notes:** Has its own pager schema — migrate to shared factory.

**Depends on:** Phase 0, Task 1.3.

## Task 2.10 — Medium: `recently`

**Touches:** `recently.controller.ts` (8 endpoints, 97 LOC).

**Depends on:** Phase 0, Task 1.3.

## Task 2.11 — Medium: `link`

**Touches:** `link.controller.ts` (9 endpoints, 115 LOC).

**Depends on:** Phase 0, Task 1.3.

## Task 2.12 — Medium: `activity`

**Touches:** `activity.controller.ts` (14 endpoints, 408 LOC, 1× Bypass).

**Notes:** Many endpoints. The `Bypass` is likely SSE or websocket — verify; may need `@RawResponse`.

**Depends on:** Phase 0, Task 1.3.

## Task 2.13 — Medium: `analyze`

**Touches:** `analyze.controller.ts` (8 endpoints, 215 LOC).

**Depends on:** Phase 0, Task 1.3.

## Task 2.14 — Medium: `ai/*` (5 sub-controllers)

**Touches:**

```
apps/core/src/modules/ai/
  ai.controller.ts                            (5 endpoints, 326 LOC)
  ai-agent/ai-agent.controller.ts
  ai-insights/ai-insights.controller.ts
  ai-summary/ai-summary.controller.ts
  ai-task/ai-task.controller.ts
  ai-translation/ai-translation.controller.ts
  ai-translation/translation-entry.controller.ts
  ai-writer/ai-writer.controller.ts
```

**Notes:**

- Multiple sub-modules. Group into 2-3 PRs by sub-feature (agent+task, insights+summary, translation+writer).
- AI streaming endpoints (if any) need `@RawResponse`.

**Depends on:** Phase 0, Task 1.3.

## Task 2.15 — Medium: `auth`

**Touches:**

```
apps/core/src/modules/auth/
  auth.controller.ts          (6 endpoints, 124 LOC)
  device.controller.ts        (2 endpoints, 225 LOC, 2× Bypass)
```

**Notes:**

- Sessions/tokens are core. Error codes are critical (`AUTH_INVALID_CREDENTIALS`, `AUTH_SESSION_EXPIRED`, `AUTH_DEVICE_FLOW_PENDING`).
- `device.controller.ts` Bypass usages are likely device-flow polling — verify if they actually need raw or can be envelope-wrapped (probably yes).

**Depends on:** Phase 0, Task 1.3.

## Task 2.16 — Light: `enrichment`

**Touches:** `enrichment.controller.ts` (12 endpoints, 272 LOC).

**Notes:** Enrichment results are themselves a meta concern elsewhere — but this controller manages CRUD over enrichment entries. Distinct concern.

**Depends on:** Phase 0, Task 1.3.

## Task 2.17 — Light: `file`

**Touches:**

```
apps/core/src/modules/file/
  file.controller.ts          (12 endpoints, 360 LOC, 1× Bypass for download)
  comment-upload.controller.ts (2 endpoints, 33 LOC)
```

**Notes:** Upload responses fit envelope. Download endpoint stays `@RawResponse` (binary stream).

**Depends on:** Phase 0, Task 1.3.

## Task 2.18 — Light: smaller resource modules

**Touches (one PR each, can be parallelized):**

```
ack/ack.controller.ts                  (1 endpoint, 55 LOC)
say/say.controller.ts                  (1 endpoint, 16 LOC)
project/project.controller.ts          (0 endpoints, 7 LOC — likely scaffold; verify)
init/init.controller.ts                (5 endpoints, 82 LOC)
reader/reader.controller.ts            (3 endpoints, 29 LOC; uses PagerDto)
meta-preset/meta-preset.controller.ts  (6 endpoints, 81 LOC)
webhook/webhook.controller.ts          (8 endpoints, 63 LOC; uses PagerDto)
helper/helper.controller.ts            (2 endpoints, 95 LOC)
markdown/markdown.controller.ts        (3 endpoints, 162 LOC, 1× Bypass)
poll/poll.controller.ts                (3 endpoints, 58 LOC, 1× Bypass)
option/controllers/base.option.controller.ts (1× Bypass)
option/controllers/email.option.controller.ts
configs/                               (no controller file — verify if it has one)
subscribe/subscribe.controller.ts      (5 endpoints, 77 LOC, 2× Bypass)
```

**Notes:**

- Each gets the same treatment as a heavy module, but the work per file is small. Several can be combined into a single PR ("Light modules batch A/B/C").

**Depends on:** Phase 0, Task 1.3.

## Task 2.19 — Bypass-only modules (eliminate or rename)

**Touches:** modules whose endpoints only exist because of non-JSON content. Replace `@HTTPDecorators.Bypass` with `@RawResponse`.

```
feed/feed.controller.ts            (1× Bypass — RSS XML)
pageproxy/pageproxy.controller.ts  (3× Bypass — HTML render)
render/render.controller.ts        (1× Bypass — HTML render)
sitemap/sitemap.controller.ts      (1× Bypass — XML)
snippet/snippet-route.controller.ts (1× Bypass — user-defined content type)
snippet/snippet.controller.ts      (1× Bypass on one endpoint; rest are JSON CRUD — verify & migrate JSON ones)
serverless/serverless.controller.ts (4× Bypass — user-defined functions; keep raw)
```

**Notes:**

- All-Bypass controllers: just rename the decorator and ensure `AppExceptionFilter` still emits JSON error envelopes on throw.
- Mixed (`snippet.controller.ts` has CRUD + one raw endpoint): split work — JSON endpoints follow Phase 2 standard, raw endpoints get `@RawResponse`.

**Depends on:** Phase 0.

## Task 2.20 — Bypass that should be removed entirely

**Touches:** endpoints whose response can fit `{ data }` envelope and currently use Bypass only for historical reasons.

```
health/health.controller.ts        (1× Bypass — /ping → return { ok: true })
server-time/server-time.controller.ts (1× Bypass — single number → { timestamp })
update/update.controller.ts        (1× Bypass — verify response shape)
debug/debug.controller.ts          (1× Bypass — likely JSON output)
dependency/dependency.controller.ts (1× Bypass — verify)
cron-task/cron-task.controller.ts  (1× Bypass — verify; admin endpoint)
backup/backup.controller.ts        (2× Bypass — one is download stream, keep raw; one likely status JSON)
owner/owner.controller.ts          (1× Bypass — verify)
auth/device.controller.ts          (2× Bypass — verify if polling responses can be enveloped)
```

**Notes:** Audit each before deciding. Some "verify" cases may legitimately need `@RawResponse`.

**Depends on:** Phase 0.

## Task 2.21 — `app.controller.ts` (root)

**Touches:** `apps/core/src/app.controller.ts` (1× Bypass).

**Notes:** Likely a `/api` root or version endpoint. Verify and migrate.

**Depends on:** Phase 0.

---

# Phase 3 — Cleanup

After every controller is migrated and Yohaku/admin-vue3 are updated to consume the new shape.

## Task 3.1: Delete legacy interceptors and decorators

**Deletes:**

```
apps/core/src/common/interceptors/json-transform.interceptor.ts
apps/core/src/common/interceptors/response.interceptor.ts          (the OLD one; V2 stays under same name after rename)
apps/core/src/common/interceptors/translation-entry.interceptor.ts
apps/core/src/common/decorators/translate-fields.decorator.ts
apps/core/src/utils/case.util.ts
```

**Renames:**

```
apps/core/src/common/response/response.interceptor.ts → src/common/interceptors/response.interceptor.ts
```

**Touches:**

- `app.module.ts` / global pipeline wiring — remove old interceptor providers.
- Any remaining importers (should be zero by this point — grep to confirm).

**Depends on:** All of Phase 2.

## Task 3.2: Delete `Bypass` alias

**Touches:** `apps/core/src/common/decorators/http.decorator.ts`

- Remove `Bypass` export; keep `RawResponse`.
- Verify zero importers of `HTTPDecorators.Bypass`.

**Depends on:** All of Phase 2.

## Task 3.3: Audit and migrate generic exceptions

**Touches:**

```
apps/core/src/common/exceptions/
  cant-find.exception.ts              (rewrite to extend AppException with code='NOT_FOUND')
  ban-in-demo.exception.ts            (rewrite)
  biz.exception.ts                    (rewrite)
  no-content-canbe-modified.exception.ts (rewrite)
```

**Notes:**

- Each existing generic exception gets a stable code. Per-module exceptions added in Phase 2 already do this.
- The `AppExceptionFilter` already handles bare `HttpException`s, but per-module typed exceptions are preferable for monitoring.

**Depends on:** All of Phase 2.

## Task 3.4: Documentation update

**Touches:**

```
apps/core/CLAUDE.md
README files
docs/superpowers/specs/2026-05-15-v2-api-response-design.md  (mark Status: Implemented)
```

**Notes:**

- Update the "API Response Rules" section in `apps/core/CLAUDE.md` (currently describes the old wrapping rules).
- Add a short "Writing a new endpoint" guide pointing at envelope + views + meta builder + AppException.
- Update OpenAPI generation if it exists.

**Depends on:** All of Phase 2 + 3.1-3.3.

---

# Cross-Cutting Concerns Checklist

These don't fit neatly in a phase but must be tracked.

- [ ] **`pnpm -C apps/core run lint`** and **`pnpm -C apps/core run typecheck`** must pass on every PR.
- [ ] **E2E snapshot tests** for `/posts/:id`, `/posts`, `/notes/:id`, `/notes`, `/comments`, `/auth/login`, `/file/upload`, `/aggregate/top` — added during Phase 0 (against the old shape), updated during Phase 2 (against the new shape) per module.
- [ ] **Yohaku frontend** + **admin-vue3** need a coordinated update. Track separately; cleanup PR (Phase 3.1) cannot land until both consumers have migrated.
- [ ] **API client packages** (`packages/api-client`, `packages/webhook`) — regenerate types after Phase 2; bump versions.
- [ ] **OpenAPI / Swagger** generation — verify the new envelope is correctly described. If using nestjs-zod or zod-to-openapi, the envelope wrapping must be reflected.
- [ ] **Webhook payload shape** — verify whether external subscribers depend on the current shape. If yes, the webhook controller is a special case (keep old shape or version webhook payloads).
- [ ] **RSS / sitemap feed** consumers are XML; no change needed beyond `@RawResponse` rename.
- [ ] **GraphQL** — none in this codebase, but confirm.
- [ ] **WebSocket / SSE gateways** (`apps/core/src/processors/gateway/`) emit events, not HTTP responses — out of scope for the envelope refactor. Confirm no gateway payload depends on case conversion that the deleted `JSONTransformInterceptor` was performing; if one does, that conversion must be reapplied at the gateway.

## Per-Module Stats Table

| Module | Endpoints | LOC | Bypass | Translate | Paginate | Weight |
|---|---|---|---|---|---|---|
| note | 13 | 803 | 0 | 7 | 1 | Heavy |
| comment | 14 | 446 | 0 | 0 | 0 | Heavy |
| activity | 14 | 408 | 1 | 0 | 0 | Medium |
| aggregate | 17 | 379 | 0 | 3 | 0 | Heavy |
| post | 10 | 364 | 0 | 4 | 2 | Heavy |
| file | 12 | 360 | 1 | 0 | 0 | Light |
| ai | 5 | 326 | 0 | 0 | 0 | Medium |
| enrichment | 12 | 272 | 0 | 0 | 0 | Light |
| auth/device | 2 | 225 | 2 | 0 | 0 | Medium |
| analyze | 8 | 215 | 0 | 0 | 0 | Medium |
| page | 8 | 212 | 0 | 0 | 1 | Heavy |
| category | 6 | 207 | 0 | 2 | 0 | Heavy |
| serverless | 5 | 168 | 4 | 0 | 0 | Bypass |
| markdown | 3 | 162 | 1 | 0 | 0 | Light |
| pageproxy | 3 | 161 | 3 | 0 | 0 | Bypass |
| render | 2 | 142 | 1 | 0 | 0 | Bypass |
| snippet-route | 0 | 139 | 1 | 0 | 0 | Bypass |
| snippet | 10 | 130 | 1 | 0 | 0 | Mixed |
| auth | 6 | 124 | 0 | 0 | 0 | Medium |
| draft | 10 | 122 | 0 | 0 | 0 (DraftPagerDto) | Medium |
| update | 0 | 119 | 1 | 0 | 0 | Bypass-audit |
| backup | 8 | 115 | 2 | 0 | 0 | Mixed |
| link | 9 | 115 | 0 | 0 | 0 | Medium |
| feed | 1 | 101 | 1 | 0 | 0 | Bypass |
| recently | 8 | 97 | 0 | 0 | 0 | Medium |
| helper | 2 | 95 | 0 | 0 | 0 | Light |
| debug | 3 | 86 | 1 | 0 | 0 | Bypass-audit |
| init | 5 | 82 | 0 | 0 | 0 | Light |
| meta-preset | 6 | 81 | 0 | 0 | 0 | Light |
| search | 5 | 81 | 0 | 2 | 0 | Medium |
| subscribe | 5 | 77 | 2 | 0 | 0 | Mixed |
| topic | 3 | 65 | 0 | 3 | 0 | Medium |
| webhook | 8 | 63 | 0 | 0 | 0 (PagerDto) | Light |
| cron-task | 3 | 61 | 1 | 0 | 0 | Bypass-audit |
| owner | 4 | 61 | 1 | 0 | 0 | Bypass-audit |
| poll | 3 | 58 | 1 | 0 | 0 | Bypass-audit |
| dependency | 1 | 56 | 1 | 0 | 0 | Bypass-audit |
| ack | 1 | 55 | 0 | 0 | 0 | Light |
| comment-upload (file) | 2 | 33 | 0 | 0 | 0 | Light |
| sitemap | 1 | 35 | 1 | 0 | 0 | Bypass |
| health | 2 | 30 | 1 | 0 | 0 | Bypass-audit |
| reader | 3 | 29 | 0 | 0 | 0 (PagerDto) | Light |
| say | 1 | 16 | 0 | 0 | 0 | Light |
| server-time | 1 | 13 | 1 | 0 | 0 | Bypass-audit |
| project | 0 | 7 | 0 | 0 | 0 | Scaffold (verify) |

> **Table is incomplete.** The 7 `ai/` sub-controllers (`ai-agent`, `ai-insights`, `ai-summary`, `ai-task`, `ai-translation`, `translation-entry`, `ai-writer`) and the 2 `option/` controllers (`base.option`, `email.option`) are *not* listed as rows — the `ai` row covers only `ai.controller.ts`. Their endpoints and LOC are excluded from the totals. Task 2.14 and Task 2.18 do enumerate the files; the planner should fill in per-controller stats before sizing those PRs. All LOC figures were captured from an earlier snapshot and have drifted slightly (e.g. `note` is 799, not 803; `activity` is 406, not 408) — re-scan before relying on them for sizing.

(Total endpoints: ~250, **excluding the AI sub-controllers and `option` controllers**. Total LOC across controllers: ~7,000, same caveat.)

## Estimated Sequencing

A reasonable execution order (subject to writing-plans refinement):

1. **Week 1:** Phase 0 (0.1 - 0.4) — infrastructure, no controller churn.
2. **Week 2:** Phase 1.1 - 1.2 — `packages/db-schema` rename per file.
3. **Week 2-4:** Phase 1.3 — `apps/core` ripple, one module per PR.
4. **Week 3-6:** Phase 2 — module migrations. Light/bypass modules can run in parallel; heavy modules sequentially because they share the meta builder and may reveal needed builder methods.
5. **Week 6:** Consumer-side (Yohaku, admin) catch-up.
6. **Week 7:** Phase 3 — cleanup.

Heavy modules in execution order: **post → page → note → comment → category → aggregate** (aggregate last because it depends on post/note/page views).
