# V2 API Downstream Integration — Design Spec

**Status:** Draft — pending review
**Author:** Innei (with brainstorming assistance + Codex review)
**Date:** 2026-05-16
**Scope:** How the two downstream consumers (Yohaku, admin-vue3) integrate the V2
response envelope (`{ data, meta }`), and the small backend cleanup that
integration depends on. No new endpoints. Builds on
`2026-05-15-v2-api-response-design.md`.

## Motivation

V2 moved per-request derived fields (`isLiked`, `isTranslated`, `translationMeta`,
`enrichments`, `related`) off the entity and into a separate `meta` object. The
wire envelope work is done; both consumers already unwrap `{ data, meta }`,
camelCase the body, and parse the error envelope. What is missing is a coherent,
low-churn way for per-request `meta` to reach the UI.

An earlier draft proposed attaching non-enumerable `$interaction` / `$translation`
getters to each entity. That approach was rejected after review: non-enumerable
getters are silently lost on `{...spread}`, `JSON.stringify`, deep clone, and —
critically — TanStack Query dehydration/persistence, which admin-vue3 already uses
(`apps/admin/src/lib/query-client.ts`). Cached entities round-trip through JSON,
so the getters would vanish in production. Getter magic is also undebuggable: a
logged or copied entity shows no sign of the meta-derived fields the UI renders.

This spec adopts the reviewed alternative: a plain, explicit `metaFor(item, meta)`
helper plus one normalization chokepoint per frontend.

## Goals

- Per-request `meta` reaches the UI through an explicit, testable, serializable
  path — no hidden descriptors.
- Call-site churn in each frontend is contained to one normalization layer, not
  spread across every component.
- `data` is genuinely flat (the resource schema, nothing injected), so the
  integration is not built on a contract the backend silently violates.
- `meta` is camelCase in code, consistent with the rest of the codebase.
- list vs detail `meta` shape is unambiguous — no object-shape sniffing.

## Non-Goals

- Migrating admin-vue3 onto `@mx-space/api-client`. Its `ofetch` wrapper owns
  auth redirects, toast behavior, and cache-busting; replacing it is out of scope.
- Backwards compatibility with the V1 entity shape. Consumers update in lockstep.
- Re-merging `meta` back onto the entity. The whole point of V2 is the split;
  the helper keeps it explicit.

## Design

### §0. Backend prerequisites

Downstream integration assumes `data` is flat and `meta` is camelCase. Three
backend debts must be paid first, in `apps/core`.

**§0.1 — `meta.types.ts` to camelCase.** `src/common/response/meta.types.ts`
currently declares schema fields in snake_case (`is_liked`, `total_pages`,
`source_lang`, `available_translations`, …). This contradicts the V2 convention
("code is camelCase end to end; `ResponseInterceptorV2` snake_cases at the wire
boundary"). Convert every field in `meta.types.ts` to camelCase and update
`MetaObjectBuilder` call sites in controllers accordingly (e.g.
`.interaction({ is_liked })` → `.interaction({ isLiked })`). The wire output is
unchanged — the interceptor still produces snake_case.

**§0.2 — Explicit list vs detail meta keys.** `ResponseMetaSchema` currently
unions a single object with an id-keyed record for `interaction` and
`translation`, and relies on `EntryTranslationSchema.strict()` so snowflake ids
cannot collide with the `article`/`fields` keys. This is fragile (empty objects,
future non-snowflake ids). Replace the union with two distinct keys:

```ts
// detail responses
interaction: InteractionMetaSchema.optional(),
translation: EntryTranslationSchema.optional(),
// list responses
interactionById: z.record(z.string(), InteractionMetaSchema).optional(),
translationById: z.record(z.string(), EntryTranslationSchema).optional(),
```

`MetaObjectBuilder` gets paired methods: `interaction(single)` /
`interactionById(map)`, `translation(single)` / `translationById(map)`. The
`.strict()` snowflake-collision workaround is removed.

**§0.3 — Pay down the flat-data debt.** `data` still carries injected derived
fields in detail endpoints:

- `post.controller.ts` detail builds `baseDoc = { ...postDocument,
  hasInsightsInLocale, related: translatedRelated }`, then
  `attachEnrichments(baseDoc)` adds enrichments onto `data`.
- `note.controller.ts` detail builds `currentData = { ...current,
  hasInsightsInLocale }`.

Move these out of `data`:

- `related` → `meta.related` (key already exists). `meta.related` is itself
  per-request, so the translated title is baked directly into each
  `meta.related` item when the meta is built — the controller no longer mutates
  `related` items spread on `data`.
- enrichments → `meta.enrichments` (key already exists); the controller stops
  also spreading them onto `data`.
- `hasInsightsInLocale` → a new closed meta key `meta.insights: { hasInLocale:
  boolean }` for detail responses. Adding it follows the §4 rule from the V2
  spec (edit `ResponseMetaSchema` + add a builder method).

After §0.3, `data` for a detail response equals the resource's `detail` view and
nothing else.

### §1. Client envelope contract (both consumers)

Both consumers keep `data` and `meta`; neither discards `meta`.

**api-client.** `core/client.ts` already unwraps the envelope and exposes a
`$meta` getter via `extractResponseMeta`. Bug: `extractResponseMeta` returns the
raw adapter response body's `meta`, which is **never** run through
`camelcaseKeys` — so `data` is camelCase while `$meta` is snake_case. Fix:
`$meta` must return camelCased meta, consistent with `data`.

**admin-vue3.** `apps/admin/src/utils/request.ts` `transformResponse` currently
returns the bare unwrapped `data`, or `{ data, pagination }` when
`meta.pagination` is present, and discards the rest of `meta`. Changing it to
always return `{ data, meta }` would break every existing call site that expects
bare `data`. Instead, leave `request.get`/`post`/… unchanged and add a parallel
`request.getWithMeta` (and siblings as needed) that returns `{ data, meta }`.
Only the resources that consume per-request meta (posts, pages, notes) switch to
the `*WithMeta` variant; all other call sites are untouched. The returned
`{ data, meta }` is a plain serializable object, so it survives TanStack Query
persistence.

### §2. The `metaFor` helper

A plain, pure function — no descriptors, fully serializable, unit-testable:

```ts
function metaFor(item: { id: string }, meta: ResponseMeta | undefined): {
  interaction?: InteractionMeta
  translation?: EntryTranslation
} {
  if (!meta) return {}
  return {
    interaction: meta.interactionById?.[item.id] ?? meta.interaction,
    translation: meta.translationById?.[item.id] ?? meta.translation,
  }
}
```

Because §0.2 made the keys distinct, the helper needs no `Array.isArray` check
and no object-shape sniffing: list responses populate `*ById`, detail responses
populate the singular keys. Response-level meta (`enrichments`, `pagination`,
`view`, `related`, `insights`) is read directly off `meta`, not through
`metaFor`.

### §3. Yohaku integration

Yohaku already has a normalization layer in
`apps/web/app/data/content.server.ts` (4200+ lines): `normalizeGenericItems`,
`normalizeArticleTranslationMeta`, `normalizeArticleEnrichmentMap`,
`normalizeThinkingEnrichment`, and the `GenericItem` type. This layer is the
single chokepoint.

The work: change these functions to source per-request fields from `meta` via
`metaFor` instead of from fields previously spread on the entity. `GenericItem`'s
shape (`isTranslated`, `translationMeta`, `enrichments`, `related`, …) does not
change — only where the normalizer reads them from. Components downstream of the
normalizer are untouched. While editing, remove stale snake_case reads (e.g.
`post.translation_meta` in `content.server.ts`).

### §4. admin-vue3 integration

`request.ts` carries `meta` per §1. Per resource that needs per-request meta
(posts, pages, notes), add a composable or API-layer mapper that calls `metaFor`
and exposes `interaction` / `translation` to the view. The `api/*.ts` modules and
their model types (`~/models/*`) are realigned to the flat `data` views; derived
fields are no longer on the model type.

### §5. Helper distribution

`@mx-space/api-client` exports `metaFor` and the meta types from a
framework-agnostic entry point (no axios/fetch/Vue/React dependency). Yohaku
imports it directly. admin-vue3 does **not** add an `@mx-space/api-client`
dependency; it **mirrors** `metaFor` in its own repo. Both copies are covered by
the same fixture set (identical input/output JSON fixtures committed to each
repo) so the implementations cannot drift.

### §6. Types

`ModelWithLiked` and `ModelWithTranslation` in `packages/api-client` are removed.
A `data` item is exactly its view type (e.g. `PostOf<'card'>`). Per-request meta
is obtained explicitly through `metaFor`, whose return type is independent of the
entity type. No wrapper type fuses entity and meta.

## Sequencing

The work splits into ordered workstreams:

1. **Backend (§0)** — `apps/core`. Must land first; §1–§4 depend on flat `data`
   and camelCase `meta`. Independently shippable.
2. **api-client (§1, §2, §5, §6)** — `packages/api-client`. Depends on §0.
3. **Yohaku (§3)** — depends on §2 (`metaFor` published).
4. **admin-vue3 (§1, §4, §5)** — depends on §0; mirrors `metaFor`.

Workstreams 3 and 4 are independent of each other and can proceed in parallel
once their dependencies land.

## Testing

- **Backend:** existing V2 response e2e tests updated for the camelCase `meta`
  and the `*ById` keys. New assertions that detail `data` carries no
  `hasInsightsInLocale` / `related` / enrichments.
- **`metaFor`:** unit tests for list lookup by string id, detail direct object,
  absent `meta`, and absent per-item entry. The same fixtures run against both
  the api-client copy and the admin-vue3 copy (§5).
- **Yohaku:** the `content.server.ts` normalizers get fixture-based tests for the
  new `meta`-sourced path.
- **admin-vue3:** `transformResponse` test confirming `meta` is no longer
  dropped.

## Risks

- **Backend §0 is a breaking wire change.** Acceptable: V2 is unreleased and
  consumers update in lockstep. The §0.2 rename and §0.1 casing change must land
  before any consumer is pointed at the new build.
- **Mirrored `metaFor` drift.** Mitigated by the shared fixture set (§5). If
  drift becomes a real problem, the fallback is admin-vue3 taking the
  api-client dependency after all.
- **`content.server.ts` size.** The file is already 4200+ lines. This spec does
  not require splitting it, but the normalizer edits are a reasonable occasion to
  extract the normalization functions into their own module if it can be done
  without disturbing unrelated code.
