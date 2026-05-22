# Translation In-Place Overwrite Design

**Date:** 2026-05-22
**Status:** Approved (pending implementation plan)
**Branch:** refactor/v2-api-response
**Author:** Innei

## Problem

After the V3 response envelope refactor (commit 5543aa47), per-request
translation was moved out of `data` and into `meta.translation.<id>.article`.
For an article with id `X`, the wire looked like:

```jsonc
{
  "data":  { "id": "X", "title": "代码与多巴胺…", "text": "…", … },
  "meta":  {
    "translation": {
      "X": {
        "article": {
          "is_translated": true,
          "source_lang": "zh",
          "target_lang": "en",
          "title": "Code & Dopamine…",
          "text":  "…",
          "content": "…",
          "content_format": "lexical",
          "available_translations": ["ko", "ja", "en"]
        }
      }
    }
  }
}
```

This duplicates the translatable fields (`title`, `text`, `content`,
`content_format`, etc.) — the canonical value lives in `data` in the source
language, and a translated copy lives in `meta`. Consumers must either
re-merge `meta` back into `data` (which the user has rejected as a
compatibility shim) or carry a parallel `data + meta` model through every
layer.

The user’s constraint: **no data redundancy**. When a translation exists,
it should overwrite the original field in place — wherever that field
lives, `data` or nested, it gets replaced. `meta` should only carry
information that has no `data` counterpart.

## Goals

1. Eliminate the duplicate carrying of translated content in both `data`
   and `meta`.
2. Restore the pre-V3 behaviour where `?lang=xx` produces a response whose
   `data.title`, `data.text`, etc., are already in the requested language.
3. Cover every endpoint that V1 translated, including dictionary-mode
   value mappings (`note.mood`, `note.weather`) and entity-mode lookups
   (`topic.*`, `category.name`).
4. Keep a slim, well-typed `meta.translation` block for the metadata that
   has no `data` counterpart (`is_translated`, `source_lang`,
   `target_lang`, `available_translations`, `translated_at`, `model`).
5. Restore V1 wire parity through the api-client legacy adapter without
   the adapter having to re-translate.

## Non-Goals

- No DB schema change. `ai_translations` and `translation_entries` keep
  their current shape.
- No change to the AI translation pipeline, hashing, cache invalidation,
  or background materialisation.
- No change to the envelope contract itself (`{data, meta?}` for success,
  `{error}` for errors). Only the per-endpoint payload shape changes.
- Front-end consumption refactoring (Yohaku, admin-vue3) is tracked as a
  follow-up PR, not part of this spec.

## Core Principles

1. **In-place overwrite.** When a translation exists for a field, it
   overwrites the original at the field’s position in the response —
   `data.title`, `data.topic.name`, `data.next.mood`, `data.related[].title`,
   `data[].topic.name`, all overwritten where the original sits.
2. **No redundancy.** A translated value never appears in both `data` and
   `meta`. If a field is overwritten in `data`, it is not echoed in `meta`.
3. **`meta.translation` is metadata only.** It carries the bookkeeping
   about the translation (was it translated, from what source, what
   target, when, by which model, what other targets are available) — never
   the translated text.
4. **Dict ≠ entity.** `translation_entries` supports two lookup modes
   that must remain distinct end-to-end:
   - **Entity mode:** `lookupKey = entityId`. Used for
     `topic.name/introduce/description`, `category.name`. The same id maps
     1:1 to a translated value per lang.
   - **Dict mode:** `lookupKey = hash(sourceValue)`. Used for
     `note.mood`, `note.weather`. The same source value maps 1:1 to a
     translated value per lang, regardless of which note it appeared in.

## Wire Contract

### Success envelope (article detail)

```jsonc
{
  "data": {
    "id": "X",
    "title": "Code & Dopamine…",          // translated in place
    "text":  "…",                          // translated in place
    "content": "…",                        // translated in place (if present)
    "content_format": "lexical",
    "topic": {
      "id": "Y",
      "name": "Current Update",            // entry-translated in place
      "introduce": "…",                    // entry-translated in place
      "description": "…"
    },
    "mood":    "Happy",                    // dict-translated in place
    "weather": "Sunny",                    // dict-translated in place
    "next": {
      "id": "Z",
      "title": "…",                        // translated in place
      "topic": { "name": "…" },            // entry-translated in place
      "mood": "…", "weather": "…"          // dict-translated in place
    },
    "prev": { /* … */ }
  },
  "meta": {
    "view": "detail",
    "translation": {
      "X": {
        "article": {
          "is_translated": true,
          "source_lang": "zh",
          "target_lang": "en",
          "translated_at": "2026-05-22T…Z",
          "model": "claude-haiku-4-5",
          "available_translations": ["ko", "ja", "en"]
        }
      },
      "Z": { "article": { /* same shape for next */ } }
    },
    // insights, enrichments, interaction, related etc. unchanged
  }
}
```

### Success envelope (list / aggregate / activity)

Each item carries its translated fields in place. `meta.translation`
carries one slim metadata block per item id:

```jsonc
{
  "data": [
    { "id": "X1", "title": "…(translated)", "topic": { "name": "…(translated)" }, … },
    { "id": "X2", "title": "…(translated)", … }
  ],
  "meta": {
    "translation": {
      "X1": { "article": { "is_translated": true, "source_lang": "zh", … } },
      "X2": { "article": { "is_translated": false, "source_lang": "zh", "available_translations": ["en"] } }
    }
  }
}
```

### Removed fields

- `meta.translation.<id>.article.title`
- `meta.translation.<id>.article.text`
- `meta.translation.<id>.article.subtitle`
- `meta.translation.<id>.article.summary`
- `meta.translation.<id>.article.tags`
- `meta.translation.<id>.article.content`
- `meta.translation.<id>.article.content_format`
- `meta.translation.<id>.fields` (entry/dict translations now overwrite
  data — there is no `fields` block any more)

Sub-entity entries (topic/category) and cached-title translations
(`related[].title`, aggregate item titles, etc.) do **not** emit any
`meta.translation` entry — they have no per-row metadata to expose.

## Zod Schema Changes

`apps/core/src/common/response/meta.types.ts`:

```ts
export const ArticleTranslationSchema = z
  .object({
    isTranslated: z.boolean(),
    sourceLang: z.string().nullable().optional(),
    targetLang: z.string().nullable().optional(),
    translatedAt: z.date().optional(),
    model: z.string().optional(),
    availableTranslations: z.array(z.string()).optional(),
  })
  .strict() // ← must be strict at the article level too
// Removed: title, text, subtitle, summary, tags, content, contentFormat

export const EntryTranslationSchema = z
  .object({ article: ArticleTranslationSchema.optional() })
  .strict()
// Removed: fields
```

Both `ArticleTranslationSchema` and `EntryTranslationSchema` are
`.strict()`. Outer-only `.strict()` on `EntryTranslationSchema` would
let removed inner fields (`title`, `text`, etc.) be silently stripped
rather than rejected — that would let a regression slip past
`MetaObjectBuilder.build()`. Tests must assert the *removed* fields
produce a Zod parse error, not a stripped output.

## Helpers — `helper.translation.service.ts`

### 1. `buildArticleTranslationMeta` (slim)

Drops `title/text/subtitle/summary/tags/content/contentFormat`. Returns
only the metadata shape above. The `extras` parameter is removed.

`translatedAt`, `model`, and `targetLang` are read from
`result.translationMeta.*`, **not** from `result.*` — the
`TranslationResult` type nests those fields:

```ts
{
  isTranslated: result.isTranslated,
  sourceLang: result.sourceLang ?? null,
  targetLang: result.translationMeta?.targetLang ?? lang ?? null,
  translatedAt: result.translationMeta?.translatedAt,
  model: result.translationMeta?.model,
  availableTranslations: result.availableTranslations ?? [],
}
```

### 2. `applyArticleTranslationInPlace(target, result, opts?)`

```ts
applyArticleTranslationInPlace<T extends Record<string, unknown>>(
  target: T,
  result: TranslationResult,
  opts?: {
    fields?: Array<'title'|'text'|'content'|'contentFormat'|'subtitle'|'summary'|'tags'>
  },
): T
```

- Default `fields` covers all seven.
- Overwrites `target[field] = result[field]` only when
  `result.isTranslated === true` **and** `result[field] != null`. This
  preserves the original `content` when a markdown-only article has no
  lexical translation, and preserves original `summary/tags` when the
  translation row doesn’t carry them.
- **`content` and `contentFormat` are paired**: `contentFormat` is only
  overwritten when `content` is also being overwritten in the same call.
  Writing `contentFormat` without `content` would leave the document in
  an inconsistent state (e.g. `format='lexical'` over markdown body).
  Internally:

  ```ts
  if (translatedContent) {
    target.content = translatedContent
    target.contentFormat = translatedContentFormat ?? target.contentFormat
  }
  ```
- Mutates `target` and returns it (for spread-readability at call sites).

### 3. `applyTranslationEntriesInPlace(target, maps, rules)`

```ts
type EntryMaps = {
  entityMaps: Map<TranslationEntryKeyPath, Map<string, string>>
  dictMaps:   Map<TranslationEntryKeyPath, Map<string, string>>
}

type EntryRule =
  | { path: string; keyPath: TranslationEntryKeyPath; mode: 'dict' }
  | { path: string; keyPath: TranslationEntryKeyPath; mode: 'entity'; idField: string }

applyTranslationEntriesInPlace(target, maps, rules: EntryRule[]): void
```

- `path` is a dotted path against `target` (e.g. `'topic.name'`, `'mood'`).
  No `[]` wildcards — call sites pass a concrete object (single article,
  or one list item). For lists, the caller iterates.
- Entity mode: reads `target.<idField...>` from the parent of `path` and
  looks up `entityMaps.get(keyPath).get(id)`.
- Dict mode: reads the current value at `path` and looks up
  `dictMaps.get(keyPath).get(sourceValue)`. (Hashing is done inside the
  map builder, see §4 — the call site passes the raw source value.)
- Overwrites only on hit. No-op otherwise.

### 4. `TranslationEntryService.fetchByLookups` (batched)

Existing two-mode lookup endpoint, re-exposed with a stable signature:

```ts
fetchByLookups(lang, {
  entityLookups: Array<{ keyPath: TranslationEntryKeyPath; lookupKeys: string[] }>,
  dictLookups:   Array<{ keyPath: TranslationEntryKeyPath; sourceTexts: string[] }>,
}): Promise<EntryMaps>
```

Each controller assembles all entity ids and dict source values across
detail + next + prev + list items, calls once, gets
`{ entityMaps, dictMaps }`, threads to `applyTranslationEntriesInPlace`.

The work is bounded by the number of lookup groups (one per `keyPath`),
not by per-id round-trips. Current `ai-translation.repository.ts`
issues one query per group; collapsing to a single `or(...)` SQL across
all groups is an internal optimisation that may follow but is not
required by this spec.

### 5. Removed

- `EntryTranslationSchema.fields` and any code that builds
  `translation.<id>.fields` blocks.
- `getTopicTranslationFields` and any helper that returned
  `Map<topicId, Record<field, string>>` for meta — replaced by the
  `entityMaps` returned from `fetchByLookups`.

## Controller Pipeline Order (mandatory)

Each affected controller MUST execute its data-building pipeline in this
order:

```
1. Fetch source row(s) from repository
2. applyArticleTranslationInPlace(...)          ← title/text/content/...
3. applyTranslationEntriesInPlace(...)          ← mood/weather/topic.*/category.name
4. enrichmentService.attachEnrichments(...)
5. metaBuilder.translation(...) / withMeta(...)
```

Translation MUST run before enrichment. `EnrichmentService` scans
`content`/`text` to extract link cards, image enrichments, etc. If
enrichment runs against the source-language body and translation
overwrites afterwards, link-card placements and URL anchors will be
based on the source body while the visible prose is the target body —
producing visibly misaligned enrichments. Running translation first
keeps enrichment-extracted URLs in lock-step with the translated body.

## Per-Endpoint Changes

For each endpoint, list (a) fields overwritten in `data`, (b) entry
lookups required, (c) whether a `meta.translation` entry is emitted.

**List `meta.translation` policy:** for list, aggregate, and activity
endpoints, emit a slim `meta.translation.<itemId>.article` entry **only
for items that were actually translated** (`isTranslated === true`).
Items with `isTranslated: false` are omitted — this matches the
semantics of the existing `collectArticleTranslations` helper and keeps
per-item payload bounded for large pages.

For detail endpoints, always emit a slim entry for the primary id (and
for `next`/`prev` when those adjacent rows exist), even when
`isTranslated === false`, so that consumers can read
`sourceLang` / `availableTranslations` for the article they are
viewing without a second roundtrip.

### post.controller.ts

| Endpoint | Overwritten in `data` | Entry lookups | `meta.translation` |
|----------|-----------------------|---------------|---------------------|
| `GET /:category/:slug` | `title/text/content/contentFormat/summary/tags`; `related[].title`; `category.name` | `category.name` (entity, by post.category.id) | `<postId>.article` slim |
| `GET /:id` (auth) | same | same | same |
| `GET /` | item `title/text/content/contentFormat`; item `category.name` | `category.name` (entity, ids from items) | translated items only |
| `GET /latest` | item same | same | translated items only |

Existing `withMeta(...)` call sites stay; `buildArticleTranslationMeta`
returns the slim shape.

### note.controller.ts

| Endpoint | Overwritten in `data` | Entry lookups | `meta.translation` |
|----------|-----------------------|---------------|---------------------|
| `buildPublicNoteResponse` (nid, slug-date) | `title/text/content/contentFormat`; `mood/weather` (dict); `topic.{name,introduce,description}` (entity); `next/prev` same | `note.mood/weather` (dict, source values across current+next+prev); `topic.*` (entity, ids across current+next+prev) | `<currentId>.article` slim; `<nextId>.article`, `<prevId>.article` slim when adjacent exists |
| `GET /:id` (admin, also a detail route) | same as `buildPublicNoteResponse` | same | same |
| `GET /list/:id` (admin, ranged list) | item `title/text/content/contentFormat`; item `mood/weather/topic.*` | per-batch | translated items only |
| `GET /latest` | `latest` + `next` same as detail | same | `<latestId>` + `<nextId>` (both always emitted) |
| `GET /` | item `title/text/content/contentFormat` (or summary when `withSummary`); item `mood/weather/topic.*` | per-page batch | translated items only |
| `GET /topics/:id` | item `title`; item `mood/weather/topic.*` (entity lookups extended beyond V1 — V1 only covered `mood/weather`; this is an intentional expansion) | per-page batch | translated items only |

### page.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /slug/:slug` (public detail) | `title/text/subtitle/content/contentFormat` | — | `<pageId>.article` slim |
| `GET /:id` (auth detail) | same | — | same |
| `GET /` (list) | item same | — | translated items only |

### topic.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /all` | `[].name/introduce/description` | `topic.*` (entity, all topic ids) | none |
| `GET /:id`, `GET /slug/:slug` | `name/introduce/description` | `topic.*` (entity, single id) | none |

### category.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /` (with `ids`) | `entries[<id>].children[].title` (via post list) | — | translated children only |
| `GET /` (by type, no `ids`) | `[].name` | `category.name` (entity, all category ids) | none |
| `GET /:query` (regular branch) | `data.name`; `children[].title` | `category.name` (entity, this id) | translated children only |
| `GET /:query` (with `tag=true`) | `data[].title` (post list under the tag) — response shape `{ tag, data }` carries no `name`; only the post titles translate | — | translated items only |

### search.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /` | `data[].category.name` (only on post items) | `category.name` (entity, ids from post items) | none |
| `GET /:type` | same as `GET /` | same | none |

### aggregate.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /top` | `notes[]/posts[].title`; `notes[].mood/weather` | `note.mood/weather` (dict) | translated items only |
| `GET /latest` (combined/separate) | items `title`; `notes[].mood/weather` | dict | translated items only |
| `GET /timeline` | `data.notes[]/posts[].title`; `notes[].mood/weather`; `posts[].category.name` | dict + `category.name` (entity) | translated items only |
| `GET /stat/top-articles` | item `title` | — | translated items only |

### activity.controller.ts

| Endpoint | Overwritten | Entry lookups | meta |
|----------|-------------|---------------|------|
| `GET /rooms` | `objects[<type>][].title` | — | translated items only |
| `GET /reading/top`, `GET /reading/rank` | `[].ref.title` | — | translated items only, **keyed by `refId`** (see Adapter §3 below for the corresponding legacy rule) |
| `GET /recent` | likes/comments/recentPost/recentNote item `title` | — | translated items only |
| `GET /last-year/publication` | item `title` | — | translated items only |

## api-client Legacy Adapter

`packages/api-client/legacy/response-adapter.ts`:

```ts
function buildTranslationFlat(translation: any): Record<string, unknown> {
  if (!translation?.article) return {}
  const a = translation.article
  const out: Record<string, unknown> = {}
  if ('isTranslated' in a) out.isTranslated = a.isTranslated ?? false
  if (a.sourceLang != null) out.sourceLang = a.sourceLang
  if ('availableTranslations' in a) out.availableTranslations = a.availableTranslations ?? []
  if (a.isTranslated) {
    out.translationMeta = {
      sourceLang: a.sourceLang,
      targetLang: a.targetLang,
      translatedAt: a.translatedAt,
      model: a.model,
    }
  }
  return out
}
```

Changes:
1. Drop the `translation.article ?? translation` fallback — the V3 contract
   guarantees `article` is nested.
2. `translationMeta` becomes the slim metadata-only shape, which is what
   V1’s `TranslationMeta` type already was.
3. All `fields`-handling code paths are removed.
4. The rest of `flattenMetaIntoItem` (interaction, insights, enrichments,
   related) is untouched.
5. `noteDetailRule`, `noteMiddleListRule`, `noteTopicListRule`,
   `aggregateTopRule`, etc. continue to drive the V1 wire shape; the only
   inside-rule change is the slimmer translation block.
6. Existing adapter tests at
   `packages/api-client/__tests__/legacy/response-adapter.test.ts:73`
   assert that `translationMeta` carries `title/text/content` etc.
   Those expectations are updated: the translated display fields now
   live in `data` (inline), and `translationMeta` carries only
   `sourceLang/targetLang/translatedAt/model`. Add an extra assertion
   that the *translated* `data.title/text/content` are present.

### Activity reading items — adapter rule

`/activity/reading/top` and `/activity/reading/rank` items use
`refId` (not `id`) as their stable identifier:
[`activity.controller.ts:225`](../../apps/core/src/modules/activity/activity.controller.ts).
The generic `flattenMetaIntoItem` at
[`response-adapter.ts:128`](../../packages/api-client/legacy/response-adapter.ts)
keys translation lookups by `item.id` and ignores items lacking it, so
reading-ranked items would lose their `translationMeta` under the
default flow.

Add a dedicated rule (`READING_RANK_REGEX`) that, before generic
flattening, treats `refId` as the lookup id for `meta.translation`
matching:

```ts
const READING_RANK_REGEX = /^\/activity\/reading\/(top|rank)$/
const readingRankRule: Rule = {
  match: READING_RANK_REGEX,
  fn: (raw, ctx) => {
    const items: any[] = Array.isArray(raw?.data) ? raw.data : []
    return {
      ...raw,
      data: items.map((it) =>
        flattenMetaIntoItem({ ...it, id: it.refId }, ctx.meta),
      ).map(({ id: _drop, ...rest }) => rest), // strip the synthesized id
    }
  },
}
```

(Implementation detail; the goal is "translation metadata reaches the
reading item via `refId`".)

### smoke-diff harness

The smoke-diff harness lives at
`packages/api-client/scripts/smoke-diff.mjs` but is **not** currently
declared as a package script. Either:

- (a) Add a `"smoke:diff": "node scripts/smoke-diff.mjs"` entry to
  `packages/api-client/package.json`, or
- (b) Invoke directly: `node packages/api-client/scripts/smoke-diff.mjs`.

The spec assumes (a). Smoke-diff against Yohaku’s call surface must
report 0 diffs across all touched endpoints.

api-client version: bump to `5.0.2-next.9`.

## Backward-Compatibility & Migration

- Old V3 consumers reading `meta.translation.<id>.article.title` etc.
  will see those keys disappear. Yohaku and admin-vue3 are tracked as
  follow-up consumer-side PRs — neither has shipped against the V3 meta
  yet (this branch is pre-merge), so no live consumer is broken.
- Front-end memory feedback [[frontend-no-merge-v2-meta]] applies to
  other meta blocks (`pagination`, `related`, `interaction`, `insights`,
  `enrichments`) but **carves out translation**: translated content is
  threaded inline in `data`, not merged from `meta`.

## Testing

### Unit tests (helper)

- `applyArticleTranslationInPlace` with all field combinations, including
  partial translation (no `content`, no `summary`, no `tags`).
- `applyTranslationEntriesInPlace` for both dict and entity modes; hit,
  miss, nested target object, undefined intermediate paths.
- `buildArticleTranslationMeta` slim shape — never includes content
  fields.

### Controller tests

Each affected controller gets an explicit `?lang=en` test that asserts:
1. The data side carries the translated value at each path in the table
   above.
2. The meta side carries the slim metadata for each id (or no entry,
   per the table).
3. The meta side **does not** carry `title/text/content/contentFormat/
   subtitle/summary/tags/fields`.

For note detail: assert `next/prev` translations also overwrite in place.

### Schema parsing

- `ResponseMetaSchema.parse(...)` rejects payloads that include any of
  the removed fields in `meta.translation.*.article` or
  `meta.translation.*.fields`. The test must assert that the Zod parse
  throws (or `safeParse` returns `success: false`), not that the
  offending key was silently stripped — see Schema section above for
  why `ArticleTranslationSchema` itself must be `.strict()`.

### Smoke-diff (api-client)

- Run `pnpm -F @mx-space/api-client smoke:diff` against a V2 (legacy
  adapter) and V3 (current) server and assert 0 diffs across the Yohaku
  call surface.

## Rollout

1. Single PR on `refactor/v2-api-response`:
   - `apps/core/src/common/response/meta.types.ts` — slim schemas
   - `apps/core/src/processors/helper/helper.translation.service.ts` —
     new helpers
   - `apps/core/src/modules/ai/ai-translation/translation-entry.service.ts`
     — expose `fetchByLookups` (or rename existing entry point)
   - all 9 affected controllers
   - `packages/api-client/legacy/response-adapter.ts`
   - bump `@mx-space/api-client` to `5.0.2-next.9`
   - new tests + updated snapshots
2. Run `pnpm -C apps/core lint` and `pnpm -C apps/core test` against
   touched files only.
3. Smoke-diff harness against staging.
4. Merge.
5. Follow-up PR on Yohaku / admin-vue3 to drop dual-read of
   `meta.translation.<id>.article.title` and friends.

## Rollback

- `git revert` of the single PR restores V3 meta-only behaviour.
- No DB schema migration is involved, so no data rollback is required.

## Open Risks

1. **Live consumers reading slim fields.** If any external consumer
   already depends on `meta.translation.<id>.article.title` being
   present (e.g. a downstream service we don’t own), they will break.
   Mitigation: this branch hasn’t been released; the V3 wire has not
   shipped to production consumers.
2. **List meta cost.** Slim entries are emitted only for items that were
   actually translated (see policy above). For a 20-item page where 18
   items have a translation, this adds ~1.5 KB of JSON; the worst case
   is bounded by `size`.
3. **`mood/weather` dict misses.** When a value has no entry for a lang,
   the original is retained. Front-end must not assume `mood` is in the
   requested lang. Documented behaviour, matches V1.
