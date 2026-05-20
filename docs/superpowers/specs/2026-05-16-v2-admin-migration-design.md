# V2 API — admin-vue3 Migration Design Spec

**Status:** Draft — pending review
**Author:** Innei (with brainstorming assistance)
**Date:** 2026-05-16
**Scope:** Migrating the admin-vue3 dashboard (`../admin-vue3`, Vue 3 + TSX) onto
the V2 API response envelope. This is workstream 4 of
`2026-05-16-v2-downstream-integration-design.md` (the parent spec), expanded into
a complete, executable plan. Execution happens in the `admin-vue3` repo;
`apps/core` backend prerequisites (parent spec §0) must land first.

## Context

The parent spec splits every success response into `{ data, meta }`: `data` is
the flat resource schema, `meta` carries per-request / cross-cutting data
(`pagination`, `interaction`, `translation`, `enrichments`, `related`, `view`,
`insights`). It rejected non-enumerable `$`-getters (lost on spread / JSON /
TanStack persistence) in favor of an explicit `metaFor(item, meta)` helper plus
one normalization chokepoint per frontend.

admin-vue3 already has partial V2 plumbing in `apps/admin/src/utils/request.ts`:
its `ofetch` wrapper unwraps `{ data, meta }`, runs `simpleCamelcaseKeys`, parses
the error envelope (`data.error.code/message` → `BusinessError`), and returns
`{ data, pagination }` when `meta.pagination` is present. It **discards all other
`meta`**.

## Survey — what admin actually consumes

A grep across `.tsx` / `.vue` / `.ts` (admin uses Vue 3 **TSX**, not SFCs, for
most views) shows admin's per-request `meta` consumption is small and specific:

| Field | Where | V2 source |
| --- | --- | --- |
| `readCount`, `likeCount` | `views/manage-posts/list.tsx` (table columns), `views/manage-notes/list.tsx` (table columns), `views/manage-posts/category.tsx` (post card) | `meta.interactionById[id]` (list) |
| `related` | `views/manage-posts/write.tsx` (editor's related-post picker) | `meta.related` (detail) |
| `enrichments` | `views/shorthand/index.tsx` (recently/shorthand cards) | `meta.enrichments` (response-level, URL-keyed) |

admin does **not** display `isLiked`, `isTranslated`, or `translationMeta` on any
entity. (admin's AI-translation management views — `api/ai.ts`, `views/ai/` — are
a separate CRUD surface over translation *entities*, unrelated to response
`meta.translation`.) `pagination` is already handled.

So the migration is contained: three consumption sites, plus model/type
alignment and named-view adoption.

## Goals

- admin renders `readCount` / `likeCount` / `related` / `enrichments` from V2
  `meta` with no regression.
- Per-request `meta` reaches views through the `api/*.ts` layer as plain merged
  objects — view/component code stays largely unchanged, and merged objects
  survive TanStack Query persistence (`apps/admin/src/lib/query-client.ts`).
- **Full static type safety**: every step of request → mapper → view-model is
  statically checked against authoritative types; no `any` in any touched file;
  the wire shape and the view-model shape are distinct, named types.
- List endpoints request the correct named `view`.

## Non-Goals

- A *runtime* dependency on `@mx-space/api-client`. admin keeps its `ofetch`
  wrapper (it owns auth redirects, toast, cache-busting) and bundles no
  api-client code. A **type-only** devDependency is in scope (see §0).
- Changing the `use-memo-fetch-data-list.ts` list hook or the list table
  components. The normalization happens upstream in `api/*.ts`.
- Touching the AI-translation management views.

## Design

The unifying idea: **the `api/*.ts` method is the normalization chokepoint.** Each
method that needs `meta` calls `request.getWithMeta`, merges the required meta
back onto `data` as plain fields via `metaFor`, and returns the *same shape it
returns today*. Views, list hooks, and table components are untouched.

### §0. Type architecture (foundational)

Type safety hinges on one rule: **the wire `data` shape and the view-model shape
are distinct types, and neither is hand-maintained in admin.**

**Wire types.** The flat V2 view shapes (`PostSummaryView`, `PostDetailView`,
`NoteSummaryView`, …) and the meta types (`ResponseMeta`, `InteractionMeta`,
`EntryTranslation`, `EnrichmentEntry`, `RelatedRef`) are imported **type-only**
from `@mx-space/api-client`:

```ts
import type { PostSummaryView, ResponseMeta } from '@mx-space/api-client'
```

`import type` is fully erased at compile time: admin gains a `devDependency` on
api-client **for types only** — no runtime import, no bundle cost, no runtime
coupling. This honors the parent spec §5 intent (admin keeps its own `ofetch`
wrapper and bundles no api-client code) while making the types authoritative.
api-client is the single source of truth for V2 wire shapes — its exported view
types are the `z.infer` of the backend `apps/core/src/modules/*/*.views.ts`
schemas (produced by the api-client workstream, parent spec §6). Hand-mirroring
wire types in admin is **forbidden** — it is the exact drift hazard the parent
spec rejected for `metaFor`.

The backend view schemas and `meta.types.ts` are **camelCase**; admin's
`simpleCamelcaseKeys` converts the snake_case wire before any typed code observes
the value, so the declared camelCase type matches the runtime value exactly.

**Prerequisite:** `@mx-space/api-client` must export the V2 view types and meta
types from its public entry point. If the api-client workstream has not yet done
so, that export is a hard precondition for admin's typed work (§3 onward).

**View-model types.** Defined in admin `~/models/*`, each as
`WireType & <merged meta fields>`:

```ts
export type PostListItem = PostSummaryView & InteractionMeta
export type PostDetail   = PostDetailView & { related?: RelatedRef[] }
```

`InteractionMeta`'s fields are all optional, so the intersection is exact and the
table's `row.readCount ?? 0` stays valid. The view-model type is what every
`api/*.ts` method returns and what views consume.

**No `any`.** Every file touched by this migration is free of `any` in the
request → mapper → view-model chain. Pre-existing `any` in a touched file
(`models/post.ts` `meta?: any`, `write.tsx` `(r: any)`) is tightened to a real
type as part of the change.

### §1. `request.getWithMeta`

`apps/admin/src/utils/request.ts`. `transformResponse` currently discards `meta`.
Changing the existing `request.get`/`post`/… to return `{ data, meta }` would
break every call site that expects bare `data`. Instead, add parallel,
fully-generic methods:

```ts
import type { ResponseMeta } from '@mx-space/api-client'

interface WithMeta<T> { data: T; meta: ResponseMeta }

request.getWithMeta<T>(url: string, options?: RequestOptions): Promise<WithMeta<T>>
// postWithMeta / putWithMeta added only if a write endpoint needs meta
```

`T` is always a **wire view type** (§0), never a view-model type. `getWithMeta`
runs the same `simpleCamelcaseKeys` + envelope detection, returns
`{ data, meta }`, and defaults `meta` to `{}` (a valid `ResponseMeta` — every key
is optional) when the response is not an envelope. The existing bare-`data`
methods are unchanged; only api modules that need `meta` switch to `*WithMeta`.
The `T as` cast inside `transformResponse` is replaced with a checked narrowing
so no `any` leaks into the generic boundary.

### §2. `metaFor` (mirrored runtime, imported types)

Per parent spec §5 the runtime `metaFor` is **mirrored** in admin (no runtime
import). Its types, however, are imported (§0) — so the signature cannot drift,
only behavior can, which fixtures cover. Add `apps/admin/src/utils/meta-for.ts`:

```ts
import type { ResponseMeta, InteractionMeta, EntryTranslation }
  from '@mx-space/api-client'

export function metaFor(
  item: { id: string },
  meta: ResponseMeta | undefined,
): { interaction?: InteractionMeta; translation?: EntryTranslation } {
  if (!meta) return {}
  return {
    interaction: meta.interactionById?.[item.id] ?? meta.interaction,
    translation: meta.translationById?.[item.id] ?? meta.translation,
  }
}
```

The same input/output JSON fixtures used by the api-client copy are committed
under `apps/admin/src/utils/__tests__/meta-for.fixtures/` so the two
implementations cannot drift in behavior.

### §3. Model realignment

Each model in `~/models/*` is recast as a view-model type per §0:
`WireType & <merged meta fields>`, with the wire type imported from api-client.
Hand-maintained field lists are deleted, not edited.

- `models/post.ts` — `PostListItem = PostSummaryView & InteractionMeta`;
  `PostDetail = PostDetailView & { related?: RelatedRef[] }`. The old
  hand-written `PostModel` interface (and its `meta?: any`, inline `related`,
  `Category`) is removed.
- `models/note.ts` — `NoteListItem = NoteSummaryView & InteractionMeta`;
  `NoteDetail = NoteDetailView`.
- `models/recently.ts` — `RecentlyItem = RecentlyView & { enrichments?: Record<string, EnrichmentEntry> }`.
- `models/base.ts` — `PaginateResult<T>` keeps its shape; `Pager` aligns to the
  V2 `pagination` type. `BaseModel.created` (a pre-V2 remnant) is removed once
  its call sites are confirmed dead.
- Other models (`page`, `comment`, `draft`, `category`, `topic`, …) — replace
  the hand-written interface with the imported wire view type; these carry no
  per-request meta.

After realignment, `tsc` is the audit: any call site reading a field absent from
`WireView & Meta` is a compile error and is fixed at that site.

### §4. Named views (`?view=`)

V2 list endpoints accept `?view=<name>` and default to `card`. admin's post list
(`list.tsx`) reads `category`, `tags`, `modifiedAt`, `pinAt`, `summary`,
`isPublished` — the `summary` view (`card` + `tags` + `modifiedAt`) covers all.
The post editor needs the full `detail` view.

Update `api/*.ts` methods to pass `view`, and type the call against the matching
wire type:

- `postsApi.getList` → `?view=summary`, `getWithMeta<PostSummaryView[]>`;
  `postsApi.getById` → `?view=detail`, `getWithMeta<PostDetailView>`.
- `notesApi.getList` → `?view=summary`; `notesApi.getById` → `?view=detail`.
- `pagesApi` similarly.

The view name passed and the wire type parameter must agree — a mismatch is the
one place type safety cannot catch, so the pairing is kept on one line and
covered by a test asserting the returned shape.

### §5. List normalization — posts & notes

`postsApi.getList` and `notesApi.getList` become typed normalizers:

```ts
import type { PostSummaryView } from '@mx-space/api-client'
import type { PaginateResult } from '~/models/base'
import type { PostListItem } from '~/models/post'

getList: async (params): Promise<PaginateResult<PostListItem>> => {
  const { data, meta } = await request.getWithMeta<PostSummaryView[]>('/posts', {
    params: { ...params, view: 'summary' },
  })
  return {
    data: data.map((row): PostListItem => ({
      ...row,
      ...metaFor(row, meta).interaction,
    })),
    pagination: meta.pagination!,
  }
}
```

`getWithMeta<PostSummaryView[]>` types `data` as `PostSummaryView[]`;
`metaFor(row, meta).interaction` is `InteractionMeta | undefined` (spreading
`undefined` is a typed no-op); the `: PostListItem` return annotation makes TS
verify the merge produces exactly the view-model. The return type stays
`PaginateResult<PostListItem>`, so `use-memo-fetch-data-list.ts`,
`useMemoPostList` / `useMemoNoteList`, and the `list.tsx` table columns are
**unchanged** — each row carries the counts as plain enumerable fields.
`views/manage-posts/category.tsx` likewise unaffected.

### §6. Post editor — `related`

`views/manage-posts/write.tsx` reads `postData.related` to seed the related-post
picker. `postsApi.getById` merges `meta.related` onto the returned post:

```ts
getById: async (id: string): Promise<PostDetail> => {
  const { data, meta } = await request.getWithMeta<PostDetailView>(
    `/posts/${id}`,
    { params: { view: 'detail' } },
  )
  return { ...data, related: meta.related }
}
```

`meta.related` is `RelatedRef[] | undefined`, matching `PostDetail['related']`.
`write.tsx` is retyped to `PostDetail`, and its `(r: any)` callback becomes
`(r: RelatedRef)`. `usePostQuery` caches a plain object — TanStack-safe.

### §7. Recently / shorthand — `enrichments`

The trickiest site. `views/shorthand/index.tsx` reads `item.enrichments` as a
per-item `Record<url, EnrichmentEntry>` and iterates it. V2 returns
`meta.enrichments` as a **response-level** URL-keyed map shared across all items.

`recentlyApi.getAll` reconstructs a per-item slice — for each recently item,
extract the URLs referenced in `item.content` and pick those entries out of
`meta.enrichments`:

```ts
getAll: async (): Promise<RecentlyItem[]> => {
  const { data, meta } = await request.getWithMeta<RecentlyView[]>('/recently/all')
  const all = meta.enrichments ?? {}
  return data.map((item): RecentlyItem => ({
    ...item,
    enrichments: pickEnrichmentsForContent(item.content, all),
  }))
}
```

`pickEnrichmentsForContent(content: string, all: Record<string, EnrichmentEntry>):
Record<string, EnrichmentEntry>` lives next to the recently api module, is fully
typed, and is unit-tested. `shorthand/index.tsx` line 348 also *writes*
`enrichments` optimistically after a probe — that local-state update keeps
working since `enrichments` is a plain typed field on `RecentlyItem`.

### §8. Error envelope & casing — verify only

`request.ts` already maps `data.error.code/message` → `BusinessError` and runs
`simpleCamelcaseKeys`. Parent spec §0.1 makes `meta` camelCase in `apps/core`
code; the wire stays snake_case, so `simpleCamelcaseKeys` output is unchanged and
`Pager` still resolves. No change — add a regression test only.

## File change inventory

| File | Change |
| --- | --- |
| `apps/admin/package.json` | Add `@mx-space/api-client` as a **devDependency** (type-only) |
| `apps/admin/src/utils/request.ts` | Add typed `getWithMeta` (+ `postWithMeta`/`putWithMeta` if needed) |
| `apps/admin/src/utils/meta-for.ts` | New — mirrored `metaFor`, imported types |
| `apps/admin/src/utils/__tests__/meta-for.*` | New — fixture-shared tests |
| `apps/admin/src/api/posts.ts` | `getList`/`getById` typed normalizers + `view` param |
| `apps/admin/src/api/notes.ts` | `getList`/`getById` same |
| `apps/admin/src/api/pages.ts` | `view` param; meta merge if any |
| `apps/admin/src/api/recently.ts` | `getAll` enrichment reconstruction (§7) |
| `apps/admin/src/models/post.ts`, `note.ts`, `recently.ts`, `base.ts`, … | Recast as view-model types (§3) |
| `views/manage-posts/list.tsx`, `manage-notes/list.tsx`, `manage-posts/category.tsx`, `manage-posts/write.tsx`, `shorthand/index.tsx` | Mostly unchanged; retype `write.tsx` (§6); fix any `tsc` errors surfaced by §3 |

## Sequencing

1. **Prerequisites:**
   - parent spec §0 lands in `apps/core` (camelCase `meta`, `*ById` keys, flat
     `data`);
   - `@mx-space/api-client` exports V2 view types + meta types (§0 prerequisite).
2. **§0 + §1 + §2** — devDependency, `getWithMeta`, `metaFor` mirror. No behavior
   change yet.
3. **§3** — model recast. `tsc` drives the call-site fixes.
4. **§4 + §5 + §6** — posts/notes api normalization + named views. Depends on
   §0–§3.
5. **§7** — recently / shorthand enrichments. Depends on §1/§2.
6. **§8** — verification test.

## Testing

- `metaFor` — unit tests, shared fixtures (list lookup by id, detail direct,
  absent meta, absent entry).
- `postsApi.getList` / `notesApi.getList` — mocked `getWithMeta`, assert each row
  carries `readCount`/`likeCount` and `pagination` is correct.
- `postsApi.getById` — assert `related` merged from `meta.related`.
- `pickEnrichmentsForContent` — unit tests for URL extraction + slicing.
- `request.getWithMeta` — envelope with/without `meta`; error envelope still maps
  to `BusinessError`.
- **`tsc --noEmit` is the type-safety gate** — the migration is not done until it
  passes with no `any` introduced.
- Manual smoke: post list / note list count columns, post editor related picker,
  shorthand enrichment cards.

## Risks

- **api-client has not exported V2 types.** §0's `import type` precondition. If
  the api-client workstream lags, admin's typed work (§3+) is blocked. Mitigation:
  prioritize the type-export slice of the api-client workstream; it is small and
  independent of api-client's runtime changes.
- **Backend §0 not landed.** admin against a pre-§0 build sees snake_case `meta`
  and the old union keys — `metaFor` breaks. Hard ordering dependency.
- **§4 view/type pairing.** The `?view=` string and the `getWithMeta<T>` type
  parameter are coupled by convention, not by the compiler. Covered by a
  shape-assertion test per endpoint.
- **`meta.enrichments` reconstruction (§7).** URL extraction from `content` is
  heuristic. If the backend can return recently enrichments per-item instead, §7
  collapses to a trivial merge — confirm with the `apps/core` recently controller
  before implementing.
- **Mirrored `metaFor` behavior drift.** Mitigated by shared fixtures; the
  signature cannot drift since types are imported.
