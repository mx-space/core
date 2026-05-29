# Detail-route AI summary in response meta

**Date:** 2026-05-26
**Status:** Approved, pre-implementation
**Owner:** Innei

## Context

Public article detail endpoints currently force the frontend to issue a second
request to `GET /ai/summaries/article/:id?lang=...&onlyDb=1` when it wants to
render the AI-generated summary alongside the article. The two requests always
fire together and there is no scenario where the article body is rendered
without also considering the summary. We can collapse the round trip by piggy-
backing the stored summary on the article detail response via the existing
`{ data, meta }` envelope.

The mechanism already exists for analogous cross-cutting concerns:

- `insights.hasInLocale` is computed inline and attached to meta.
- `translation` per-article state is attached via `MetaObjectBuilder.translation`.
- `enrichments` rides on meta.

Adding `summary` follows the same pattern.

## Goals

- Attach a stored AI summary, when available, to the meta of public article
  detail endpoints, so the frontend does not need a second HTTP call.
- Strict language matching: only return a summary whose `lang` equals the
  client's requested language (after `parseLanguageCode` normalization).
- Zero added user-visible latency on the happy path: one extra indexed lookup,
  run in parallel with the existing `Promise.all`.
- No new generation triggered by the read path.

## Non-goals

- Generating a summary on demand from these endpoints.
- Multi-language fallback (e.g. returning a `ja` summary when `en` was
  requested). Frontend keeps the option of displaying the article's manual
  `data.summary` when this meta field is absent.
- Supporting `GET /pages/:slug`. `AiSummaryService.resolveArticleForSummary`
  explicitly rejects `CollectionRefTypes.Page`, so this is out of scope until
  the AI summary service learns to index pages.
- Admin-only routes (`GET /posts/:id`, `GET /notes/:id`). These already have
  full access to `GET /ai/summaries/article/:id` and were not requested.

## Scope: affected endpoints

| Endpoint | Controller | Handler |
| --- | --- | --- |
| `GET /posts/:category/:slug` | `PostController` | `getByCateAndSlug` |
| `GET /notes/nid/:nid` | `NoteController` | `getNoteByNid` (via `buildPublicNoteResponse`) |
| `GET /notes/:year/:month/:day/:slug` | `NoteController` | `getNoteByDateAndSlug` (via `buildPublicNoteResponse`) |

Note routes share `buildPublicNoteResponse` (`note.controller.ts:156`), so a
single edit covers both.

## Meta contract

Extend `ResponseMetaSchema` in `apps/core/src/common/response/meta.types.ts`:

```ts
export const SummaryMetaSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    lang: z.string(),
    createdAt: z.date(),
  })
  .strict()

// inside ResponseMetaSchema
summary: SummaryMetaSchema.optional(),
```

Add a matching exported `SummaryMeta` type.

Field rationale:

- `id` — lets the frontend deep-link to admin tooling or a regenerate action
  without an extra fetch.
- `text` — the summary content. Named `text` (not `summary`) to avoid
  shadowing the article's own `data.summary` field in the frontend type model.
- `lang` — the actual stored language code; always equal to the
  `parseLanguageCode(request.lang)` value the controller used for lookup,
  but echoed explicitly so the frontend never has to guess.
- `createdAt` — supports a "last updated" hint in the UI.

Field rejected:

- `model` — the `ai_summary` row does not persist the model used. Adding it
  would require a schema migration and is out of scope.

## Service layer

Add one method to `AiSummaryService`:

```ts
async getSummaryForPublicMeta(
  articleId: string,
  lang: string,
): Promise<AISummaryModel | null> {
  try {
    return await this.getSummaryByArticleId(articleId, lang)
  } catch (error) {
    this.logger.warn(
      `summary meta lookup failed: article=${articleId} lang=${lang} ${
        (error as Error).message
      }`,
    )
    return null
  }
}
```

Why a wrapper and not call `getSummaryByArticleId` directly:

- `getSummaryByArticleId` runs `resolveArticleForSummary`, which throws
  `CONTENT_NOT_FOUND_CANT_PROCESS` for unsupported types or missing records.
  Throwing inside a meta-decoration code path would tank the entire detail
  response. The wrapper guarantees null-on-failure.
- A single chokepoint to log meta lookup failures, which keeps the call sites
  in controllers terse.

## Builder

Add to `MetaObjectBuilder` (`apps/core/src/common/response/meta-builder.ts`):

```ts
summary(value: SummaryMeta): this {
  this.meta.summary = value
  return this
}
```

## Controller integration

### `PostController.getByCateAndSlug`

The handler already builds a parallel batch of lookups. Append the summary
lookup to the existing `Promise.all`:

```ts
const insightsLang = parseLanguageCode(lang)
const [
  translationResult,
  relatedTitleMap,
  entryMaps,
  hasInsightsInLocale,
  summaryDoc,
] = await Promise.all([
  this.translationService.translateArticle({ ... }),
  this.translationService.getCachedTitles(relatedIds, lang),
  this.batchCategoryEntryTranslations(lang ?? '', [postDocument]),
  this.aiInsightsService
    .hasInsightsInLang(postDocument.id, insightsLang)
    .catch(() => false),
  this.aiSummaryService.getSummaryForPublicMeta(postDocument.id, insightsLang),
])

// ...existing translation, enrichment, related handling...

const metaBuilder = new MetaObjectBuilder()
  .view('detail')
  .interaction({ isLiked: liked })
  .related(translatedRelated)
  .insights({ hasInLocale: hasInsightsInLocale })
  .enrichments(enrichments as Record<string, EnrichmentEntry>)

if (summaryDoc) {
  metaBuilder.summary({
    id: summaryDoc.id,
    text: summaryDoc.summary,
    lang: summaryDoc.lang ?? insightsLang,
    createdAt: summaryDoc.createdAt,
  })
}
```

Inject `AiSummaryService` into the controller constructor.

### `NoteController.buildPublicNoteResponse`

Same shape, mirrored to the existing note `Promise.all` block that fetches
`hasInsightsInLocale`:

```ts
const insightsLang = parseLanguageCode(lang)
const [hasInsightsInLocale, summaryDoc] = await Promise.all([
  this.aiInsightsService
    .hasInsightsInLang(current.id!, insightsLang)
    .catch(() => false),
  this.aiSummaryService.getSummaryForPublicMeta(current.id!, insightsLang),
])

const metaBuilder = new MetaObjectBuilder()
  .view('detail')
  .interaction({ isLiked: liked })
  .insights({ hasInLocale: hasInsightsInLocale })

if (summaryDoc) {
  metaBuilder.summary({
    id: summaryDoc.id,
    text: summaryDoc.summary,
    lang: summaryDoc.lang ?? insightsLang,
    createdAt: summaryDoc.createdAt,
  })
}
```

Apply once inside `buildPublicNoteResponse`. Both `getNoteByNid` and
`getNoteByDateAndSlug` go through the helper, so they are covered together.

Inject `AiSummaryService` into the note controller constructor.

## Module wiring

`AiModule` already exports `AiSummaryService` (verified
in `apps/core/src/modules/ai/ai.module.ts`).

`PostModule` already imports `AiModule` (it injects `AiInsightsService`).
`NoteModule` needs verification at implementation time; if `AiInsightsService`
is already injected into the note controller, then no module change is needed
— otherwise add `AiModule` to `NoteModule.imports` using the existing
forward-ref pattern from `AiModule`.

## Frontend / API client

`packages/api-client` consumes the OpenAPI / Zod-typed response. After this
change:

- The shared meta schema gains `summary?: SummaryMeta`.
- Type generation needs to be re-run as part of the implementation PR.
- The change is additive (`summary` is `optional`), so no breaking change for
  current consumers.

## Performance

- One additional indexed query per detail request:
  `WHERE ref_id = ? AND lang = ? AND hash = ?` against `ai_summary`.
- Runs inside the existing `Promise.all`, so wall-clock latency is bounded by
  the slowest existing lookup, not added to it.
- No new generation, no AI provider calls on this path.

## Failure modes

| Case | Behavior |
| --- | --- |
| No summary stored for `(articleId, requestedLang)` | `summary` meta omitted |
| `findValidSummary` hash mismatch (article text changed) | `summary` meta omitted (treated as no summary) |
| `resolveArticleForSummary` throws (unsupported type, deleted ref) | `summary` meta omitted, `logger.warn` |
| `AiSummaryRepository.findByHash` rejects (DB error) | `summary` meta omitted, `logger.warn` |
| AI globally disabled in config | irrelevant — read path does not consult `ai.enableSummary` |

The detail response is never failed by a summary lookup error.

## Testing

Unit (`ai-summary.service.spec.ts`):

- `getSummaryForPublicMeta` returns the stored doc on hit.
- Returns `null` and logs a warning when the inner call throws.
- Returns `null` when no stored row matches.

E2E (Vitest + pg testcontainer):

- `GET /posts/:category/:slug` with a seeded summary in `DEFAULT_SUMMARY_LANG`
  → response meta includes `summary` whose `text` matches the seeded row.
- `GET /posts/:category/:slug` with no seeded summary → no `summary` in meta.
- `GET /posts/:category/:slug?lang=en` with only a `ja` summary seeded → no
  `summary` in meta (strict).
- `GET /notes/nid/:nid` with a seeded summary → `summary` present.
- `GET /notes/:year/:month/:day/:slug` with a seeded summary → `summary`
  present (covers the date-slug code path through `buildPublicNoteResponse`).

## Out of scope (call-outs for future tickets)

- Extending `ai-summary` to support pages. Requires deciding the canonical
  text source for a page (raw text vs. lexical-extracted) and lifting the
  `CollectionRefTypes.Page` rejection in `resolveArticleForSummary`.
- Multi-language summary fallback in meta. If the frontend ends up wanting
  "best available" instead of strict match, we'd add a `?summaryFallback`
  query toggle rather than changing the default contract.
- Recording the model used to generate the summary. Needs a schema column and
  a migration; track separately.

## Implementation checklist

1. `meta.types.ts` — add `SummaryMetaSchema`, extend `ResponseMetaSchema`,
   export `SummaryMeta`.
2. `meta-builder.ts` — add `summary(...)` method.
3. `ai-summary.service.ts` — add `getSummaryForPublicMeta(...)`.
4. `post.controller.ts` — inject `AiSummaryService`, extend
   `getByCateAndSlug` `Promise.all`, attach meta.
5. `note.controller.ts` — inject `AiSummaryService`, extend
   `buildPublicNoteResponse` lookup, attach meta. Confirm `AiModule` import.
6. Unit + E2E tests as above.
7. Regenerate api-client types and commit.
