# V2 API — Yohaku Integration Design Spec

**Status:** Draft — pending review
**Author:** Innei (with brainstorming assistance + Codex review)
**Date:** 2026-05-16
**Scope:** Migrating the Yohaku frontend (`../Yohaku`, Next.js app under
`apps/web/src/`) onto the V2 API response envelope. This is workstream 3 of
`2026-05-16-v2-downstream-integration-design.md` (the parent spec), expanded into
a complete, executable plan. Execution happens in the Yohaku repo; the `apps/core`
backend prerequisites (parent spec §0) and a new `@mx-space/api-client` release
must land first.

## Context

The parent spec splits every success response into `{ data, meta }`: `data` is
the flat resource schema, `meta` carries per-request / cross-cutting data
(`pagination`, `interaction`, `translation`, `enrichments`, `related`, `view`,
`insights`). It rejected non-enumerable `$`-getters (lost on spread / JSON /
TanStack persistence) in favor of an explicit `metaFor(item, meta)` helper.

**The parent spec §3 describes Yohaku incorrectly.** It assumes a 4200-line
`apps/web/app/data/content.server.ts` chokepoint with `normalizeGenericItems`,
`normalizeArticleTranslationMeta`, `normalizeArticleEnrichmentMap`,
`normalizeThinkingEnrichment`, and a `GenericItem` type. **None of these exist.**
The real Yohaku is a Next.js app rooted at `apps/web/src/`. It has **no
normalization layer**: it consumes the published npm package
`@mx-space/api-client@4.2.0` directly, and reads per-request fields
(`isTranslated`, `translationMeta`, `related`, `enrichments`, `hasInsightsInLocale`,
pagination) off entities at roughly 50 scattered component/page sites. So the
Yohaku integration is a **distributed migration**. This spec supersedes parent
spec §3.

### Design stance — `data` and `meta` stay separate

The admin spec (`2026-05-16-v2-admin-migration-design.md` §0/§5/§6) merges the
needed `meta` fields back onto `data` as plain fields so view code stays
unchanged. **This spec deliberately rejects that for Yohaku.** Re-merging
recreates the V1 fused entity at the frontend layer, pollutes the resource schema
with non-schema fields, and makes the backend's V2 `data`/`meta` split
meaningless at the point of consumption. Yohaku keeps `data` and `meta` as two
separate, plain, pure values end to end — from `queryFn`, through the TanStack
cache, to the component. No per-request field is ever written onto `data`.

(If this principle is accepted, the admin spec should be revised to match — that
is a separate task, out of scope here.)

### Verified backend behavior

Three facts were verified against the current `apps/core` controllers and they
shape this spec:

1. **Backend §0 (parent spec §0.1 / §0.2 / §0.3) is not yet done.**
   `meta.types.ts` is still snake_case; `ResponseMetaSchema.translation` /
   `.interaction` are still unions (single object for detail, id-keyed record for
   list); post and note detail `data` still carries injected `hasInsightsInLocale`,
   `related`, and enrichments. This spec is written against the **post-§0** backend
   and lists §0 as a hard prerequisite (see §0 below and Risks).

2. **Counts do not move into `meta`.** `post.controller.ts` detail sets only
   `meta.interaction = { isLiked }`; list endpoints set no `interaction` at all.
   `likeCount` / `readCount` remain on `data` (the entity's `count` field).
   Combined with the decision to ignore `isLiked` (see Goals), **`meta.interaction`
   is entirely unused by Yohaku** — there is no count migration.

3. **`data` carries the original content; `meta.translation.article` carries the
   translation.** Under V1 the backend swapped `text` / `content` server-side when
   the request passed `?lang=`. Under V2 it does not: `data` is always the original,
   and the translated `title` / `text` / `content` / `summary` / `tags` live in
   `meta.translation.article`. **Reconciling this — without writing the translation
   back onto `data` — is the substantive work of the Yohaku migration.**

## Survey — what Yohaku consumes

A grep across `apps/web/src` (`.ts` / `.tsx`) shows Yohaku's per-request field
consumption:

| Field | Where (representative) | V2 source |
| --- | --- | --- |
| `isTranslated` / `translationMeta` | `posts/(post-detail)/[category]/[slug]/pageExtra.tsx`, `PostLexicalRenderer.tsx`, `notes/(note-detail)/detail-page.tsx`, `NoteLexicalRenderer.tsx`, `NoteHeaderNoticeCard.tsx`, `PostFeaturedCard.tsx`, `PostListItem.tsx`, `lib/og-renderer.tsx`, `lib/helper.server.ts` (~15+ sites) | `meta.translation` (detail) / `meta.translationById` (list) |
| translated post/note content (`title`/`text`/`content`/`summary`/`tags`) | rendered directly off the entity by `*LexicalRenderer` / markdown components | `meta.translation.article` |
| `related` | `posts/(post-detail)/[category]/[slug]/pageExtra.tsx` (related-post NoticeCard) | `meta.related` (detail) |
| `enrichments` | `posts/.../page.tsx`, `notes/.../detail-page.tsx`, `thinking/item.tsx`, `(page-detail)/[slug]/layout.tsx` — all feed `EnrichmentMapProvider` | `meta.enrichments` (response-level) |
| `hasInsightsInLocale` | `pageExtra.tsx`, `NoteHeaderNoticeCard.tsx` | `meta.insights.hasInLocale` (detail) |
| `pagination` | `posts/page.tsx`, `notes/page.tsx`, `notes/(topic-detail)/series/[slug]/page.tsx` (infinite) | `meta.pagination` |
| `likeCount` / `readCount` | `PostActionAside.tsx` / `NoteActionAside.tsx` (`initialCount`) | **stays on `data.count` — no migration** |
| liked boolean | `useLikeAction.ts` via the `mx-like` cookie (`isLikedBefore(id)`) | **client-side cookie — not migrated** |

Yohaku has no normalization functions to refactor. Data flows
`api-client → camelcaseKeysWithUrlSkip → React component` with no intermediate
transform. TanStack Query is used with IndexedDB persistence
(`providers/root/react-query-provider.tsx`, `idb-keyval`).

## Goals

- Yohaku renders translated articles, related posts, enrichments, and AI-insight
  availability from V2 `meta` with no regression.
- `data` stays **exactly the V2 view type** end to end. No per-request field is
  ever written onto it. `meta` is threaded as a separate, plain value through the
  existing providers; components consume per-request fields from `meta` directly.
- Translated content is resolved by a derived, ephemeral view-model computed at
  read time. The TanStack cache holds only pure, plain `{ data, meta }`; the
  derived localized entry is never cached or persisted.
- `meta.interaction.isLiked` is intentionally **not** consumed. Per Codex review:
  counts are cache-safe aggregate metadata and stay on `data`; `isLiked` is
  visitor-specific (backend derives it from request IP, Yohaku from a browser
  cookie), it is cache-hostile in a CDN-fronted public blog, and the two identity
  models legitimately disagree. Adopting server `isLiked` is a separate
  interaction-identity design, out of scope here.

## Non-Goals

- Backend changes. Parent spec §0 is a prerequisite, not part of this workstream.
- `@mx-space/api-client` internal changes. Publishing a V2 release of api-client
  (with `metaFor`, V2 meta types, V2-shaped controllers, removed `ModelWithLiked` /
  `ModelWithTranslation`) is the api-client workstream (parent spec §1/§2/§5/§6).
  This spec only **consumes** that release.
- Adopting server-side `isLiked` / changing the like cookie mechanism.
- Migrating count display — `likeCount` / `readCount` stay on `data.count`.
- Merging any `meta` field onto `data` to spare component churn. The component
  sites that read per-request fields are migrated honestly to read from `meta`.

## Design

Each per-resource `queryFn` (and each list fetcher) returns a plain
`{ data, meta }` pair: `data` is exactly the V2 view type, `meta` is the
camelCased `ResponseMeta`. Both are plain enumerable objects, so the pair survives
TanStack Query IndexedDB persistence. Nothing is merged.

Components consume per-request fields from `meta`, threaded through the existing
`Current{Post,Note,Page}DataProvider`s. The one genuinely derived concern —
which language's content to render — is handled by a read-time view-model
(`localizeEntry`), never written back to the cache.

### §0. Prerequisites

Two things land before any Yohaku work starts — neither in the Yohaku repo:

1. **Backend §0.3 lands in `apps/core`** — post and note detail controllers stop
   injecting `related`, `hasInsightsInLocale`, and enrichments onto `data` and
   move them into `meta` (`meta.related`, a new closed `meta.insights` key, and
   `meta.enrichments`). After §0.3 a detail `data` equals the resource's detail
   view and nothing else — the precondition for the data-purity stance above.
   Parent spec §0.1 and §0.2 are deliberately **not** done: §0.1 (camelCase
   `meta.types.ts`) is wire-invariant — the wire stays snake_case and api-client
   camelCases it, so Yohaku cannot observe it; §0.2 keeps the current union shape
   for `meta.translation` / `meta.interaction` (a single object on detail, an
   id-keyed record on list), which `metaFor` resolves by shape-sniffing (§3).
2. **`@mx-space/api-client` ships a V2 release.** The envelope unwrap and the
   `$meta` getter already exist on the `refactor/v2-api-response` branch
   (commit `5254ae37`) but are unpublished, and the package version is still
   `4.2.0` — identical to the stale npm release Yohaku currently pins. The
   release must:
   - bump the version and publish;
   - fix `extractResponseMeta` so `$meta` is camelCased, consistent with `data`
     (parent spec §1);
   - provide `metaFor(item, meta)` — written against the §0.2 union shape
     (shape-sniff detail single object vs list id-keyed record) — and the V2 meta
     types (`ResponseMeta`, `EntryTranslation`, `ArticleTranslation`,
     `InteractionMeta`, `EnrichmentEntry`, `RelatedRef`). `metaFor` and the types
     may instead be written locally in Yohaku if the api-client release is to
     stay minimal;
   - ideally remove `ModelWithLiked` / `ModelWithTranslation` (parent spec §6),
     though Yohaku only needs the flat types.

Both are hard prerequisites; Yohaku's typed work (§3 onward) cannot begin until
they land.

### §1. api-client version bump and the fetch adapter

`apps/web/package.json` — bump `@mx-space/api-client` from `4.2.0` to the V2
release.

`apps/web/src/lib/fetch/shared.ts` currently configures the client with
`getDataFromResponse: (response) => response as any`, passing the entire HTTP body
through. With the V2 api-client doing envelope unwrapping internally, this hook
and the `$meta` access path must be re-verified: confirm that after the bump the
api-client result resolves to the unwrapped `data` and that `$meta` is reachable
on the result. Adjust `getDataFromResponse` / the adapter wrapper only as needed
so that:

```ts
const result = await apiClient.post.getPost(category, slug, { lang })
// result === flat post view; result.$meta === camelCased ResponseMeta
```

`camelcaseKeysWithUrlSkip` (`lib/camelcase.ts`) is unchanged — the wire stays
snake_case, the keys still camelCase, and the URL-shaped enrichment-map keys are
still skipped.

### §2. The chokepoint — `queryFn` returns `{ data, meta }`

Every per-resource `queryFn` reads `$meta` synchronously off the api-client
result and returns a plain pair. It does **not** merge.

```ts
queryFn: async () => {
  const result = await apiClient.post.getPost(category, slug, { lang })
  return { data: { ...result }, meta: result.$meta ?? {} }
}
```

The spread `{ ...result }` drops the non-enumerable `$meta` / `$raw` getters,
leaving a plain `data`; `result.$meta` is already a plain `ResponseMeta` object
(api-client §0 prerequisite). The returned `{ data, meta }` is fully enumerable
and therefore TanStack-persistence-safe. `data` is exactly the V2 view type — no
field added.

| File | Query | Change |
| --- | --- | --- |
| `queries/definition/post.ts` | `post.bySlug` | `queryFn` returns `{ data, meta }` |
| `queries/definition/note.ts` | `note.byNid`, `note.bySlugDate` | same |
| `queries/definition/page.ts` | `page.bySlug` | same |

`$meta` is read **inside** the `queryFn`, before the plain pair is returned — the
non-enumerable getter never reaches the cache.

### §3. `localizeEntry` — the translated-content view-model

New module `apps/web/src/lib/api/localized-entry.ts`. Pure functions plus thin
hook wrappers; imports `metaFor` and the V2 meta types from `@mx-space/api-client`.

```ts
import { metaFor } from '@mx-space/api-client'
import type { ResponseMeta, EntryTranslation } from '@mx-space/api-client'

// pure — returns a copy with translated content fields resolved.
// adds NO fields: the result is still exactly the input view type.
function localizeEntry<T extends { id: string }>(
  entry: T,
  translation: EntryTranslation | undefined,
): T

// React hook — derived, memoized, never cached.
function useLocalizedEntry<T extends { id: string }>(
  entry: T,
  meta: ResponseMeta | undefined,
): T

// React hook — list variant, per-item localization.
function useLocalizedList<T extends { id: string }>(
  items: T[],
  meta: ResponseMeta | undefined,
): T[]

// pure — flatten meta.translation into the legacy translationMeta prop shape,
// so badge / notice components keep their existing prop type.
function selectTranslationMeta(
  meta: ResponseMeta | undefined,
  id?: string,
): { isTranslated: boolean; sourceLang?: string; targetLang?: string
     translatedAt?: string; availableTranslations?: string[] } | undefined
```

- `localizeEntry` — when `translation?.article?.isTranslated`, returns
  `{ ...entry, <translated fields> }` overlaying only fields the `article`
  actually carries (`title` / `text` / `subtitle` / `summary` / `tags` /
  `content` / `contentFormat`; `content` and `contentFormat` always copied
  together). It assumes no field is present — post-list translations omit
  `content`, note-list translations include it; "present → overlay" covers both.
  When not translated it returns `entry` unchanged. The result is the **same view
  type** — no `isTranslated` / `translationMeta` field is added; only content
  field *values* differ.
- `useLocalizedEntry` =
  `useMemo(() => localizeEntry(entry, metaFor(entry, meta).translation), [entry, meta])`.
- `useLocalizedList` maps `localizeEntry` over the list, each item resolved via
  `metaFor(item, meta)`, which shape-sniffs the union `meta.translation` (a
  single object on detail vs an id-keyed record on list — §0.2 is not done).
- `selectTranslationMeta` exposes the translation *flags* (never content) in the
  shape Yohaku's existing `TranslatedBadge` / `NoteHeaderNoticeCard` /
  `TranslationLanguageSwitcher` / `TranslationNoticeContent` already accept, so
  those leaf components keep their prop type unchanged.

The localized entry is computed at read time and lives only for the render. The
cache and the providers hold pure `data` + `meta`.

`og-renderer.tsx` / `helper.server.ts` are server-side and cannot use hooks; they
call the pure `localizeEntry` / `selectTranslationMeta` directly on the fetched
`{ data, meta }`.

### §4. Threading `meta` — provider extensions

Yohaku already wraps each detail page in `CurrentPostDataProvider` /
`CurrentNoteDataProvider` / `CurrentPageDataProvider`
(`providers/{post,note,page}/`). Extend each to hold `meta` alongside the entity:

- The provider's value becomes `{ data, meta }` (or the existing entity value
  plus a sibling `meta`).
- Add `useCurrentPostMeta()` / `useCurrentNoteMeta()` / `useCurrentPageMeta()`
  returning `ResponseMeta | undefined`.
- Add a convenience `useCurrentLocalizedPost()` (and note/page siblings) =
  `useLocalizedEntry(useCurrentPostData(), useCurrentPostMeta())`, for the content
  renderers.
- `useCurrentPostData()` and siblings are unchanged — every existing consumer of
  the raw entity (slug, category, id, dates, counts) keeps working untouched.

Every place that constructs a `Current*DataProvider` (the page-level `api.tsx` /
`detail-page.tsx` fetch sites) now passes `meta` in addition to `data`.

### §5. Detail pages — wiring

Per detail page, the per-request reads move to `meta`:

- **Translated content** (`PostLexicalRenderer`, `NoteLexicalRenderer`, the
  rendered `<h1>` title, summary/description) — consume `useCurrentLocalizedPost()`
  (note/page siblings) instead of the raw entity. Roughly 5–8 content mount points.
- **Translation flags** (`pageExtra.tsx`, `detail-page.tsx`, `NoteHeaderNoticeCard`,
  `PostFeaturedCard`, `PostListItem`) — the container reads
  `selectTranslationMeta(useCurrentPostMeta())` and passes the result as the
  `translationMeta` prop the leaf components already accept; `isTranslated` is
  `Boolean(selectTranslationMeta(meta)?.isTranslated)`. Leaf badge / notice / switcher
  components keep their prop types — only the prop *source* changes, at the
  container.
- **`related`** — `pageExtra.tsx` reads `useCurrentPostMeta()?.related ?? []` for
  the related-post NoticeCard. The backend bakes translated related-titles into
  `meta.related`, so no extra work.
- **`hasInsightsInLocale`** — `pageExtra.tsx` / `NoteHeaderNoticeCard` read
  `useCurrentPostMeta()?.insights?.hasInLocale ?? false`.

### §6. List pages and pagination

`posts/page.tsx` and `notes/page.tsx` fetch lists and destructure
`{ data, pagination }` today. The list fetchers return the plain pair, pagination
sourced from `meta`:

```ts
const result = await apiClient.post.getList(page, size, { lang, ... })
const meta = result.$meta ?? {}
return { data: [...result], meta }
```

The page component then derives display items with `useLocalizedList(data, meta)`
(translated titles for `PostFeaturedCard` / `PostListItem`), passes
`selectTranslationMeta(meta, item.id)` as each card's `translationMeta` prop, and
reads `meta.pagination` for `PostSortBar` / `PostPagination` / `NoteListPagination`.
The exact api-client V2 list return shape (a bare `T[]` carrying `$meta` vs. a
reconstructed `PaginateResult`) is settled by the api-client workstream; the
fetcher adapts, but pagination ultimately comes from `meta.pagination`.

The infinite-query case (`notes/(topic-detail)/series/[slug]/page.tsx`,
`useInfiniteQuery`) takes the same treatment per page: each page's `queryFn`
returns `{ data, meta }`; `getNextPageParam` reads `meta.pagination`; the rendered
list runs through `useLocalizedList`.

`thinking` (recently) list — same: `{ data, meta }` from the fetcher,
`useLocalizedList` at render if recently carries translation (a typed no-op if it
does not).

### §7. Enrichments

`enrichments` is consumed through `EnrichmentMapProvider`
(`components/ui/link-card/EnrichmentMapContext.tsx`), which already takes a
`Record<url, EnrichmentEntry>` and looks entries up by URL via
`useEnrichmentForUrl`. V2 `meta.enrichments` is a response-level URL-keyed map.

The provider call sites change their `value` source from `data.enrichments` to
the threaded `meta.enrichments`:

| File | Change |
| --- | --- |
| `posts/(post-detail)/[category]/[slug]/page.tsx` | `value={useCurrentPostMeta()?.enrichments ?? null}` |
| `notes/(note-detail)/detail-page.tsx` | `value={useCurrentNoteMeta()?.enrichments ?? null}` |
| `(page-detail)/[slug]/layout.tsx` | `value={useCurrentPageMeta()?.enrichments ?? null}` |
| `thinking/item.tsx` | `value` from the thinking response `meta.enrichments` — the response-level map is shared across items; lookup is by URL, so no per-item slicing is needed |

`meta.enrichments` is read straight off `meta` — it is never merged onto `data`.
The `use-inline-link-enrichment` client-side path (URLs discovered after render)
is unaffected.

### §8. Aggregate endpoint

`app/[locale]/api.tsx` `fetchAggregationData` uses `fetchServerApiJson('aggregate')`
— a raw fetch bypassing api-client. The V2 aggregate response is enveloped, so the
raw fetcher must unwrap `{ data }`. The aggregate endpoint carries no per-request
`meta` Yohaku needs (home cards show no translation/related), so only the envelope
unwrap is required. Verify the aggregate controller during implementation; if it
does emit `meta` (e.g. translation for top posts), thread it the same way.

### §9. Types

After the api-client V2 release removes `ModelWithLiked` / `ModelWithTranslation`:

- The query result type is `{ data: <FlatView>, meta: ResponseMeta }`, where
  `<FlatView>` is the V2 view type imported from `@mx-space/api-client`. No
  wrapper type fuses entity and meta.
- `localizeEntry` / `useLocalizedEntry` are typed `(<View>, …) → <View>` — the
  localized entry is the *same* type as the input, since it adds no field.
- `models/*` and `queries/definition/*` drop the `ModelWith*` wrappers; their
  hand-maintained translation fields are deleted, not edited.
- `tsc` is the audit: any component reading `isTranslated` / `translationMeta` /
  `related` / `hasInsightsInLocale` off the raw entity becomes a compile error and
  is moved to the `meta` source at that site.

## File change inventory

| File | Change |
| --- | --- |
| `apps/web/package.json` | Bump `@mx-space/api-client` `4.2.0` → V2 release |
| `apps/web/src/lib/api/localized-entry.ts` | **New** — `localizeEntry`, `useLocalizedEntry`, `useLocalizedList`, `selectTranslationMeta` |
| `apps/web/src/lib/api/__tests__/localized-entry.*` | **New** — fixture-based unit tests |
| `apps/web/src/lib/fetch/shared.ts` | Verify/adjust `getDataFromResponse` + `$meta` access for the V2 api-client |
| `apps/web/src/queries/definition/post.ts`, `note.ts`, `page.ts` | `queryFn` returns plain `{ data, meta }`; drop `ModelWith*` types |
| `apps/web/src/providers/post/CurrentPostDataProvider.tsx`, `providers/note/…`, `providers/page/…` | Hold `meta`; add `useCurrent*Meta()` + `useCurrentLocalized*()` |
| `apps/web/src/app/[locale]/posts/(post-detail)/[category]/[slug]/api.tsx`, `notes/(note-detail)/[id]/api.tsx`, `notes/(note-detail)/slug-api.ts` | Pass `meta` into the providers |
| `apps/web/src/app/[locale]/posts/page.tsx`, `notes/page.tsx` | List fetcher returns `{ data, meta }`; `useLocalizedList` + `meta.pagination` at render |
| `apps/web/src/app/[locale]/(note-topic)/notes/(topic-detail)/series/[slug]/page.tsx` | Infinite-query per-page `{ data, meta }` + `useLocalizedList` + pagination |
| `apps/web/src/app/[locale]/thinking/*` | Fetcher returns `{ data, meta }`; `useLocalizedList` if translated |
| `*LexicalRenderer.tsx`, markdown body, detail `<h1>` / summary sites | Consume `useCurrentLocalized*()` for translated content |
| `pageExtra.tsx`, `detail-page.tsx`, `NoteHeaderNoticeCard.tsx`, `PostFeaturedCard.tsx`, `PostListItem.tsx` | Read translation flags / `related` / `insights` from `meta` via `selectTranslationMeta` / `useCurrent*Meta()` |
| `posts/(post-detail)/[category]/[slug]/page.tsx`, `notes/(note-detail)/detail-page.tsx`, `(page-detail)/[slug]/layout.tsx`, `thinking/item.tsx` | `EnrichmentMapProvider value` ← `meta.enrichments` |
| `apps/web/src/app/[locale]/api.tsx` | `fetchAggregationData` unwraps the `{ data }` envelope |
| `apps/web/src/lib/og-renderer.tsx`, `apps/web/src/lib/helper.server.ts` | Use pure `localizeEntry` / `selectTranslationMeta` on the fetched `{ data, meta }` |
| `apps/web/src/models/*` | Drop `ModelWith*`-based types; align to imported V2 view types |

## Sequencing

1. **Prerequisites (§0):** backend §0.3 lands in `apps/core`; `@mx-space/api-client`
   V2 release published.
2. **§1 + §3** — version bump, `shared.ts` adapter verify, `localized-entry.ts`
   + tests. No behavior change in components yet.
3. **§9** — drop `ModelWith*` types; `tsc` produces the call-site error list.
4. **§2 + §4** — detail `queryFn`s return `{ data, meta }`; provider extensions
   + meta hooks.
5. **§5** — detail page wiring (content via `useCurrentLocalized*`, flags via
   `meta`).
6. **§6** — list + infinite-query fetchers; `useLocalizedList`; pagination.
7. **§7 + §8** — `EnrichmentMapProvider` sources; aggregate envelope unwrap.

§5–§7 are independent of each other once §2/§3/§4/§9 land and can proceed in
parallel.

## Testing

- **`localized-entry`** — unit tests with committed JSON fixtures: detail
  translated / not translated, list per-item translation, post-list translation
  (no `content`), note-list translation (with `content`), absent `meta`, absent
  per-item entry, `selectTranslationMeta` flag flattening.
- **Detail `queryFn`s** — mocked api-client result with `$meta`; assert the
  returned `{ data, meta }` is fully enumerable (JSON round-trip equality) and
  `data` carries no `isTranslated` / `translationMeta` / `related` field.
- **`useLocalizedEntry`** — renders translated `text` / `content` when
  `meta.translation.article.isTranslated`, original otherwise; the input entry is
  not mutated.
- **List fetchers** — `{ data, meta }` shape; `useLocalizedList` translates each
  card title; `pagination` comes from `meta.pagination`.
- **`tsc --noEmit`** — the type gate; the migration is not done until it passes
  with no new `any`.
- **Manual smoke:** a translated post and a translated note (content, title,
  translation notice, language switcher), the related-post card, enrichment link
  cards on post / note / page / thinking, post and note list pages with
  pagination, an AI-insights badge.

## Risks

- **Backend §0.3 not landed.** Without it, `related` / `enrichments` /
  `hasInsightsInLocale` stay on `data`, the §5 / §7 `meta` reads find nothing, and
  `data` is not the pure view type the design depends on. Hard prerequisite.
  §0.1 / §0.2 are intentionally skipped — `metaFor` is written against the union
  `meta.translation` shape, so they are not blockers.
- **api-client V2 release not published.** Yohaku consumes `metaFor`, the V2 meta
  types, and the V2-shaped controllers from the release. §0 precondition. If the
  api-client workstream lags, Yohaku's typed work (§3+) is blocked.
- **Provider contract change.** Extending `Current*DataProvider` to carry `meta`
  changes its construction contract — every site that mounts a provider must now
  supply `meta`. `tsc` catches omissions; the §4 edit and the page-fetch edits
  must land together.
- **`availableTranslations` only present when translated.** Viewing an
  original-language article yields no `meta.translation`, so the language switcher
  cannot list alternatives. A backend follow-up should always emit
  `availableTranslations`; until then `selectTranslationMeta` returns `undefined`
  and the switcher must tolerate it.
- **Translated Lexical `content` shape.** `meta.translation.article.content` must
  be valid Lexical JSON in the same dialect as the original, with `contentFormat`
  alongside it. If the translation pipeline ever returns markdown there while the
  entity is Lexical, the renderer breaks — covered by the translated-detail smoke
  test.
- **`$meta` reachability after the api-client bump.** `lib/fetch/shared.ts`'s
  `getDataFromResponse` was written for the V1 client. §1 is a verify-and-adjust
  step; if `$meta` is not reachable on the api-client result, the `queryFn`s have
  nothing to read. Validate first, before §2.
- **Aggregate envelope.** `fetchServerApiJson` is a raw fetch; if the aggregate
  response shape is mis-assumed, the home page breaks. §8 must verify against the
  live `apps/core` aggregate controller.
