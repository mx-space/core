# Skill Bundle Distribution & Response Meta Builder Refactor

**Status:** Draft
**Date:** 2026-06-19
**Author:** Innei (via brainstorming)

## Summary

Two related changes shipped in a single PR:

1. **Skill bundle distribution.** A post-attached skill is no longer a single
   `SKILL.md` blob. It is a **directory** in the snippet VFS containing a main
   `SKILL.md` plus arbitrary supporting files (`references/*.md`,
   `scripts/*.sh`, nested subdirectories, etc.) — matching the Codex /
   Anthropic skill convention. The post detail response gains an asset
   manifest so AI agents and the public Yohaku UI can enumerate the bundle.

2. **Per-resource `MetaObjectBuilder`.** The current monolithic
   `MetaObjectBuilder` is split into a cross-cutting base and per-resource
   subclasses (`PostMetaBuilder`, `NoteMetaBuilder`). The `skills` field is
   placed on `meta.skills` from day one — fixing an existing V2 violation
   where post detail returns `{ ...post, skills }`. As part of this PR we
   also retire Yohaku's `withArticleMeta` merger and switch ~20 consumers to
   read meta from `payload.$meta` directly, completing the long-pending
   no-merge migration.

## Motivation

### Skill bundle

The previous skill design (`2026-06-17-post-skill-attachment-design.md`)
shipped skills as single-blob markdown. The `mx-core` snippet subsystem then
underwent a VFS refactor (`2026-06-18-snippet-vfs-refactor-design.md`) so
every snippet row is a file in a flat path-keyed namespace, with bundle
operations (recursive list, prefix delete, prefix move) supported at the
repository layer. Multi-file skills now work physically.

What remains is the **distribution contract**. The current
`PublicSkillView` returned by `findSkillsByIds` describes only the root
`SKILL.md` row — `{ id, name, description, rawUrl, raw }`. A bundle's
supporting files exist in the VFS but are invisible to consumers. AI agents
that want to pull an entire skill bundle (Codex pulling a skill mid-task,
Claude Code installing it as a workspace skill) have no way to enumerate
the asset list without auth-gated VFS list endpoints. Yohaku's standalone
skill page renders only the root markdown.

### MetaObjectBuilder

`apps/core/src/common/response/meta-builder.ts` defines a single
`MetaObjectBuilder` class with methods for every cross-cutting concern:
`pagination`, `view`, `translation`, `interaction`, `enrichments`,
`related`, `articles`, `insights`, `summary`. Reader / webhook / draft
controllers use only `pagination`; post controller uses nine of them; new
post-only fields (skills) would keep accumulating on this single class.

Worse, the current post controller does:

```ts
const result = skills.length > 0 ? { ...docData, skills } : docData
return withMeta(result, metaBuilder.build())
```

— mixing post-attached metadata into the post entity itself. This violates
the V2 "thread `{data, meta}` separately; never re-merge" rule recorded as
project memory and forces Yohaku's client-side `withArticleMeta` merger to
keep growing. Adding `skills` to `meta` properly creates an opportunity to
also retire the merger on Yohaku.

## Goals

- A post detail response returns enough metadata for an AI agent to fetch
  the entire skill bundle (root + every asset) using public `/s/<path>` GETs
  with no additional auth or list-endpoint plumbing.
- `findSkillsByIds` becomes `findSkillBundlesByIds`, returning a
  `SkillBundleView` per skill with an `assets[]` manifest.
- The public-facing `raw` field is removed from the bundle view (Yohaku
  never consumed it; AI agents fetch via `rawUrl`).
- `POST /snippets/import` becomes transactional and upsert-by-path so an AI
  agent can push a whole bundle in one request without partial-state risk.
- `MetaObjectBuilder` is split into a cross-cutting base plus
  `PostMetaBuilder` / `NoteMetaBuilder` subclasses. The base remains for
  reader/webhook/draft/page.
- The post controller emits `skills` via `meta.skills`, not as a `data`
  field.
- Yohaku stops merging meta into data. `withArticleMeta` and
  `withPaginatedArticleMeta` are deleted; consumers read `payload.$meta`.

## Non-Goals

- Binary asset support in skill bundles (images, fonts). Text-only, same
  as VFS Refactor.
- Per-bundle `private` semantics. Each row keeps its own `private` flag
  (per-file). The visibility rule is "drop any private row when
  `includePrivate=false`", applied independently to the root SKILL.md and
  each asset.
- A `/skills` index page or skill marketplace. Discovery still happens
  through posts.
- Versioning, signing, or trust cards for skill bundles. Deferred.
- A new admin UI for skill bundles. The existing snippet VFS admin already
  handles directory-shaped resources (per the VFS refactor).
- Migrating any of `aiSummary`, `articleTranslation`, `hasInsightsInLocale`,
  `related`, `enrichments`, `interaction` away from being also-merged on the
  mx-core side. Server still emits them in meta only; Yohaku stops the
  client-side merge. (mx-core side was already meta-only for these.)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Snippet VFS layer                                        │
│  - SnippetType.Skill at path */SKILL.md  (existing)      │
│  - Assets = same-prefix rows of any type                 │
│  - Repository.findAssetsByDirs(dirs[], opts)             │
├─────────────────────────────────────────────────────────┤
│ Snippet service                                          │
│  - findSkillBundlesByIds(ids, { includePrivate })        │
│      → SkillBundleView[]                                 │
│  - importSnippets() — transactional upsert by path       │
├─────────────────────────────────────────────────────────┤
│ Response meta layer                                      │
│  - BaseResponseMetaSchema + MetaObjectBuilder            │
│      pagination, view, translation, interaction,         │
│      enrichments                                         │
│  - PostResponseMetaSchema + PostMetaBuilder              │
│      + insights, related, articles, summary, skills      │
│  - NoteResponseMetaSchema + NoteMetaBuilder              │
│      + summary                                           │
├─────────────────────────────────────────────────────────┤
│ Controller layer                                         │
│  - post.controller — PostMetaBuilder, skills via meta    │
│  - note.controller — NoteMetaBuilder                     │
│  - page / reader / webhook / draft — base                │
├─────────────────────────────────────────────────────────┤
│ api-client                                               │
│  - exports BaseResponseMeta, PostResponseMeta,           │
│    NoteResponseMeta                                      │
│  - ResponseMeta kept as deprecated superset alias        │
├─────────────────────────────────────────────────────────┤
│ Yohaku                                                   │
│  - withArticleMeta / withPaginatedArticleMeta deleted    │
│  - Query layer returns { data, meta }                    │
│  - ~20 consumers read from $meta via articleMetaOf()     │
└─────────────────────────────────────────────────────────┘
```

## Snippet Layer

### Data model

No schema change. The VFS Refactor (2026-06-18) already supports
arbitrary-depth POSIX paths and the `SnippetType.Skill` variant. A bundle
is identified by the path of its root `SKILL.md` — its directory is
`row.path.slice(0, -'/SKILL.md'.length)`.

### `SkillBundleView` shape

```ts
export type SkillBundleView = {
  id: string                    // SKILL.md snippet id
  name: string                  // path.split('/').at(-2)
  description: string           // SKILL.md frontmatter description
  rawUrl: string                // /s/<dir>/SKILL.md
  assets: SkillAssetView[]      // siblings under same prefix, excludes root
}

export type SkillAssetView = {
  path: string                  // relative to bundle dir, e.g. "references/foo.md"
  rawUrl: string                // /s/<dir>/<asset-path>
  type: SnippetType             // text / json / yaml / function / json5 / skill
  size: number                  // UTF-8 byte length of `raw`
}
```

Decisions:

- **No `raw` field on `SkillBundleView`.** The previous `PublicSkillView`
  embedded the full SKILL.md body. Yohaku's post detail card never read it
  (it renders only `name` + `description`), and Yohaku's standalone skill
  page fetches `/s/sk/<name>` directly. The field was dead weight.
- **No `raw` on `SkillAssetView`.** Same reason. Two-stage fetch: post
  detail returns the manifest, consumers GET each asset via its `rawUrl`.
  For an AI agent pulling N files, this is N HTTP requests against the
  already-existing public route — no new endpoint needed.
- **`size`** ships in the manifest so a client can budget downloads
  before fetching.
- **`type`** ships so a client can decide format-specific handling without
  inspecting content.

### `findSkillBundlesByIds`

```ts
async findSkillBundlesByIds(
  ids: string[],
  options: { includePrivate?: boolean } = {},
): Promise<SkillBundleView[]> {
  if (ids.length === 0) return []
  const skillRows = await this.snippetRepository.findSkillsByIds(
    ids,
    options.includePrivate ?? false,
  )
  if (skillRows.length === 0) return []

  const dirs = skillRows.map(row => stripSkillSuffix(row.path))
  const assetRows = await this.snippetRepository.findAssetsByDirs(
    dirs,
    { includePrivate: options.includePrivate ?? false },
  )

  const urlConfig = await this.configsService.get('url')
  const serverUrl = urlConfig?.serverUrl ?? ''
  const byDir = groupAssetsByDir(assetRows, dirs)
  const ordered = orderRowsByInputIds(skillRows, ids)
  return ordered.map(row =>
    toSkillBundleView(row, byDir.get(stripSkillSuffix(row.path)) ?? [], serverUrl),
  )
}
```

The single asset query batches all bundles in the request — `WHERE path
LIKE 'dir1/%' OR path LIKE 'dir2/%' ...` with the corresponding
`AND path <> 'dir1/SKILL.md'` exclusions. For typical post pages (1–3
linked skills, each with <20 files), this is one DB query for the entire
manifest.

### `findAssetsByDirs` repository method

```ts
async findAssetsByDirs(
  dirs: string[],
  opts: { includePrivate: boolean },
): Promise<SnippetRow[]> {
  if (dirs.length === 0) return []
  const filters: SQL[] = []
  for (const dir of dirs) {
    filters.push(
      and(
        sql`${snippets.path} like ${`${dir}/%`}`,
        ne(snippets.path, `${dir}/SKILL.md`),
      )!,
    )
  }
  let where: SQL = or(...filters)!
  if (!opts.includePrivate) {
    where = and(where, eq(snippets.private, false))!
  }
  const rows = await this.db
    .select()
    .from(snippets)
    .where(where)
    .orderBy(asc(snippets.path))
  return rows.map(mapRow)
}
```

Asset rows are ordered by full path so the manifest is stable across
requests.

### Visibility rule

`includePrivate=false` (public Yohaku, unauthenticated):

- A `SKILL.md` row with `private=true` does **not** appear in
  `findSkillsByIds` (existing behaviour).
- An asset row with `private=true` does **not** appear in the manifest.
  The asset's `/s/<path>` endpoint still rejects unauthenticated access
  (also existing behaviour).

`includePrivate=true` (admin / authenticated):

- All rows visible. Manifest includes private assets, marked the same way
  as public ones.

There is no special bundle-level private flag; visibility is purely
per-row.

### `POST /snippets/import` — transactional upsert

Current behaviour (`snippet.controller.ts:61`):

```ts
async importSnippets(@Body() body: SnippetMoreDto) {
  const { snippets } = body
  await Promise.all(
    snippets.map(snippet => this.snippetService.create(snippet as any)),
  )
  return 'OK'
}
```

Two problems for skill bundles:

- `Promise.all(create)` — concurrent inserts, no transaction. A bundle
  half-applied if one row fails validation.
- `create` only — collides on existing paths, so re-pushing an updated
  bundle fails.

New behaviour:

```ts
@Post('/import')
@Auth()
async importSnippets(@Body() body: SnippetMoreDto) {
  const result = await this.snippetService.importSnippets(body.snippets)
  return result  // { created, updated, snippets }
}
```

```ts
// snippet.service.ts
async importSnippets(inputs: SnippetCreateInput[]): Promise<{
  created: number
  updated: number
  snippets: SnippetRow[]
}> {
  const prepared = await Promise.all(inputs.map(i => this.prepareInput(i)))
  return this.snippetRepository.upsertManyByPath(prepared)
}
```

The repository wraps the loop in `this.db.transaction(async tx => { ... })`,
calling `findAnyByPath` + insert-or-update per row inside the transaction.
Cache invalidation runs after the transaction commits. If any
`prepareInput` throws (e.g. invalid frontmatter, malformed JSON), the
transaction never opens — no DB write.

Response shape:

```ts
{
  created: number,
  updated: number,
  snippets: SnippetRow[],  // already lean-transformed
}
```

The `packages` field on `SnippetMoreDto` is preserved as a no-op input —
it was a legacy serverless-dep hint. Not removed in this PR.

### Route layer

`SnippetRouteController` (`/s/*`) needs no changes. Asset access at
`/s/<dir>/<asset-path>` already works: an asset row with `type=text|json|...`
matches the exact-path data branch; `type=function` matches the function
branch with method routing. The existing skill-redirect behaviour
(`path` → `path/SKILL.md`) covers `/s/<dir>` → `/s/<dir>/SKILL.md`.

The `applySkillResponseHeaders` (`Content-Type: text/markdown; charset=utf-8`)
is unchanged. Assets respond with their natural content type as before.

## Response Meta Layer

### Schema layering

`apps/core/src/common/response/meta.types.ts` splits the schema:

```ts
export const BaseResponseMetaSchema = z.object({
  pagination: PaginationSchema.optional(),
  view: z.string().optional(),
  translation: z.union([
    EntryTranslationSchema,
    z.record(z.string(), EntryTranslationSchema),
  ]).optional(),
  interaction: z.union([
    InteractionMetaSchema,
    z.record(z.string(), InteractionMetaSchema),
  ]).optional(),
  enrichments: z.record(z.string().url(), EnrichmentEntrySchema).optional(),
})

export const PostResponseMetaSchema = BaseResponseMetaSchema.extend({
  insights: InsightsMetaSchema.optional(),
  related: z.array(RelatedRefSchema).optional(),
  articles: z.record(z.string(), RelatedRefSchema).optional(),
  summary: SummaryMetaSchema.optional(),
  skills: z.array(SkillBundleViewSchema).optional(),
})

export const NoteResponseMetaSchema = BaseResponseMetaSchema.extend({
  summary: SummaryMetaSchema.optional(),
})

// Kept as deprecated alias for backward compatibility of imports.
export const ResponseMetaSchema = PostResponseMetaSchema.merge(NoteResponseMetaSchema)
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>

export type BaseResponseMeta = z.infer<typeof BaseResponseMetaSchema>
export type PostResponseMeta = z.infer<typeof PostResponseMetaSchema>
export type NoteResponseMeta = z.infer<typeof NoteResponseMetaSchema>
```

`SkillBundleViewSchema` is defined alongside `SkillBundleView` in
`snippet.views.ts` and re-exported through `meta.types.ts` to keep the
single source of truth.

### Builder hierarchy

```ts
// common/response/meta-builder.ts
export class MetaObjectBuilder<
  TSchema extends z.ZodTypeAny = typeof BaseResponseMetaSchema,
> {
  protected readonly meta: Partial<z.infer<TSchema>> = {}
  constructor(
    protected readonly schema: TSchema = BaseResponseMetaSchema as TSchema,
  ) {}

  pagination(v: LegacyPaginationLike): this { /* ... */ }
  view(name: string): this { /* ... */ }
  translation(v: EntryTranslation | Map<string, EntryTranslation>): this { /* ... */ }
  interaction(v: InteractionMeta | Map<string, InteractionMeta>): this { /* ... */ }
  enrichments(v: Record<string, EnrichmentEntry>): this { /* ... */ }

  build(): z.infer<TSchema> {
    return this.schema.parse(this.meta) as z.infer<TSchema>
  }
}

// modules/post/post-meta-builder.ts
export class PostMetaBuilder extends MetaObjectBuilder<typeof PostResponseMetaSchema> {
  constructor() { super(PostResponseMetaSchema) }
  insights(v: InsightsMeta): this {
    ;(this.meta as PostResponseMeta).insights = v
    return this
  }
  related(v: RelatedRef[]): this { /* ... */ }
  articles(v: ArticleRefMap): this { /* ... */ }
  summary(v: SummaryMeta): this { /* ... */ }
  skills(v: SkillBundleView[]): this { /* ... */ }
}

// modules/note/note-meta-builder.ts
export class NoteMetaBuilder extends MetaObjectBuilder<typeof NoteResponseMetaSchema> {
  constructor() { super(NoteResponseMetaSchema) }
  summary(v: SummaryMeta): this { /* ... */ }
}
```

`build()` returns the precise per-resource type, so a controller that
assigns the result back to a `PostResponseMeta`-typed variable gets full
TS inference.

### Controller updates

| Controller          | Old           | New                                 |
| ------------------- | ------------- | ----------------------------------- |
| `post.controller`   | `MetaObjectBuilder` | `PostMetaBuilder`             |
| `note.controller`   | `MetaObjectBuilder` | `NoteMetaBuilder`             |
| `page.controller`   | `MetaObjectBuilder` | `MetaObjectBuilder` (unchanged) |
| `draft.controller`  | `MetaObjectBuilder` | `MetaObjectBuilder` (unchanged) |
| `reader.controller` | `MetaObjectBuilder` | `MetaObjectBuilder` (unchanged) |
| `webhook.controller`| `MetaObjectBuilder` | `MetaObjectBuilder` (unchanged) |

The key behavioural change is in `post.controller`:

```ts
// Before — post.controller.ts:289
const result = skills.length > 0 ? { ...docData, skills } : docData
return withMeta(result, metaBuilder.build())

// After
const metaBuilder = new PostMetaBuilder()
  .view('detail')
  .enrichments(enrichments)
  .translation(translationMap)
  .skills(skills)  // attached on meta, not data
return withMeta(docData, metaBuilder.build())
```

The same change applies to the `getLatest` flow (line 272 area) and to
`getByCateAndSlug` (line 392 area).

### Case-conversion compatibility

`ResponseInterceptor` (`apps/core/src/common/response/`) converts `data`
and `meta` to snake_case on the wire. Per-resource meta schemas are
plain Zod objects with no `BypassCaseTransform`-class fields; the existing
`transformResponseCase` walks both branches identically. No interceptor
change.

### api-client surface

`packages/api-client/src/response/meta.types.ts` exports
`BaseResponseMeta`, `PostResponseMeta`, `NoteResponseMeta`. `ResponseMeta`
stays as `PostResponseMeta & NoteResponseMeta` aliased and JSDoc-tagged
`@deprecated — use the per-resource type instead`. No request shape
changes.

## Yohaku No-Merge Cleanup

### Deletions

In `apps/web/src/lib/api/meta.ts`:

- `withArticleMeta()` — delete
- `withPaginatedArticleMeta()` — delete
- `ArticleMetaFields` type — delete
- `ArticleMetaModel<T>` type — delete
- `NotePayloadWithMeta<T>` — rewrite as `{ data: T, meta?: NoteResponseMeta }`
- `PaginateResultWithMeta<T>` — rewrite as
  `{ data: T[], pagination: Pager, $meta?: PostResponseMeta }`
- `getArticleTranslation` — keep (already meta-first)
- `hasNextPage` / `hasPrevPage` — keep (independent paginator helpers)

In `apps/web/src/lib/api/meta.test.ts`:

- Delete `withArticleMeta` tests
- Add tests for the new `articleMetaOf` helper

### New helpers

```ts
// apps/web/src/lib/api/article-meta.ts
import type {
  EnrichmentEntry,
  InteractionMeta,
  NoteResponseMeta,
  PostResponseMeta,
  RelatedRef,
  SkillBundleView,
  SummaryMeta,
} from '@mx-space/api-client'

export type ArticleMetaView = {
  translation: PostResponseMeta['translation'] | undefined
  summary: SummaryMeta | undefined
  hasInsightsInLocale: boolean
  related: RelatedRef[]
  enrichments: Record<string, EnrichmentEntry> | undefined
  interaction: InteractionMeta | undefined
  isLiked: boolean | undefined
  likeCount: number | undefined
  readCount: number | undefined
  skills: SkillBundleView[]
}

const flattenInteraction = (
  raw: PostResponseMeta['interaction'] | NoteResponseMeta['interaction'],
  itemId?: string,
): InteractionMeta | undefined => {
  if (!raw) return undefined
  if ('isLiked' in raw || 'likeCount' in raw || 'readCount' in raw) {
    return raw as InteractionMeta
  }
  if (itemId && typeof raw === 'object') {
    return (raw as Record<string, InteractionMeta>)[itemId]
  }
  return undefined
}

const flattenTranslation = (
  raw: PostResponseMeta['translation'] | NoteResponseMeta['translation'],
  itemId?: string,
) => {
  if (!raw) return undefined
  if ('article' in raw) return raw.article
  if (itemId && typeof raw === 'object') {
    return (raw as Record<string, { article?: unknown }>)[itemId]?.article
  }
  return undefined
}

export const articleMetaOf = (
  meta: PostResponseMeta | NoteResponseMeta | undefined,
  itemId?: string,
): ArticleMetaView => {
  const interaction = flattenInteraction(meta?.interaction, itemId)
  return {
    translation: flattenTranslation(meta?.translation, itemId),
    summary: meta?.summary,
    hasInsightsInLocale: ('insights' in (meta ?? {}))
      ? (meta as PostResponseMeta).insights?.hasInLocale ?? false
      : false,
    related: ('related' in (meta ?? {}))
      ? ((meta as PostResponseMeta).related ?? [])
      : [],
    enrichments: meta?.enrichments,
    interaction,
    isLiked: interaction?.isLiked,
    likeCount: interaction?.likeCount,
    readCount: interaction?.readCount,
    skills: ('skills' in (meta ?? {}))
      ? ((meta as PostResponseMeta).skills ?? [])
      : [],
  }
}
```

### Query / store reshape

`queries/definition/post.ts`:

```ts
queryFn: async ({ queryKey }) => {
  const data = await apiClient.post.getPost(category, slug, { ... })
  return { data, meta: data.$meta }  // no merge
}
```

Return type: `{ data: PostModel, meta: PostResponseMeta | undefined }`.

Stores that previously held a merged `ArticleMetaModel<PostModel>` switch
to holding `{ data, meta }`. Existing selector hooks like
`useCurrentPostDataSelector` retain their name but operate on `data` only;
a sibling `useCurrentPostMetaSelector` is added for meta access.

### Consumer migration

Files that need to switch from merged-field reads to `meta` reads
(roughly 20 files; full list verified against grep at implementation
time):

```
apps/web/src/
├── lib/api/meta.ts
├── lib/api/meta.test.ts
├── queries/definition/post.ts
├── queries/definition/note.ts
├── app/[locale]/
│   ├── posts/page.tsx
│   ├── posts/(post-detail)/[category]/[slug]/
│   │   ├── page.tsx
│   │   ├── pageExtra.tsx
│   │   ├── PostDetailClient.tsx
│   │   └── PostLexicalRenderer.tsx
│   ├── notes/page.tsx
│   ├── notes/(note-detail)/
│   │   ├── detail-page.tsx
│   │   ├── NoteDetailClient.tsx
│   │   ├── [id]/pageExtra.tsx
│   │   └── [id]/NoteLexicalRenderer.tsx
│   ├── thinking/post-box.tsx
│   ├── thinking/item.tsx
│   ├── (home)/components/BottomSection.tsx
│   ├── (page-detail)/[slug]/layout.tsx
│   └── preview/page.tsx
└── components/
    ├── modules/post/PostFeaturedCard.tsx
    ├── modules/post/PostListItem.tsx
    ├── modules/note/NoteMetaBar.tsx
    └── modules/note/NoteActionAside.tsx
```

`components/ui/markdown/Markdown.tsx` and
`components/ui/link-card/LinkCard.tsx` show up in the grep; they need to
be re-checked at implementation — they may be transparent pass-throughs
rather than meta readers, in which case the props signature change
propagates naturally.

### Component prop reshape

Components that previously accepted `ArticleMetaModel<PostModel>` change
to either:

```ts
{ data: PostModel; meta?: PostResponseMeta }
```

or — for components that don't need meta — accept `PostModel` directly
and let the caller pick. Pick on a case-by-case basis to keep prop
surface area minimal.

### Test fixtures

Mock post / note payloads in test files switch from a single merged
object to `{ data, meta }`. Existing tests that asserted
`result.aiSummary?.text` etc. switch to asserting on `result.meta?.summary?.text`.

## Migration Sequence

All commits land in a single PR but the staged ordering keeps each commit
locally green.

### Stage A — Snippet bundle service (mx-core)

1. `snippet.types.ts` — add `SkillBundleView`, `SkillAssetView`.
2. `snippet.views.ts` — add `SkillBundleViewSchema`, `toSkillBundleView`,
   `stripSkillSuffix`. Delete `toPublicSkillView` and `PublicSkillView`
   (only one internal caller; updated in Stage B).
3. `snippet.repository.ts` — add `findAssetsByDirs`, `upsertManyByPath`.
4. `snippet.service.ts` — add `findSkillBundlesByIds`, `importSnippets`.
   The old `findSkillsByIds` is renamed and its single in-repo caller
   (post controller) is updated in Stage B. No alias is kept (no external
   consumers).
5. `snippet.controller.ts` — rewrite `importSnippets` to call the new
   service method.
6. Faux unit tests: bundle view construction, prefix query, private
   filtering, transactional import (rollback on invalid input, upsert on
   existing path).

### Stage B — Meta builder split (mx-core)

7. `meta.types.ts` — split into `BaseResponseMetaSchema`,
   `PostResponseMetaSchema`, `NoteResponseMetaSchema`. Add
   `SkillBundleViewSchema` to `PostResponseMetaSchema`. Keep
   `ResponseMetaSchema` as a deprecated alias.
8. `meta-builder.ts` — make the base class generic over the schema.
9. `modules/post/post-meta-builder.ts` — new file.
10. `modules/note/note-meta-builder.ts` — new file.
11. `post.controller.ts` — switch to `PostMetaBuilder`; move `skills`
    from `data` into `meta.skills`. Both the `getLatest` flow and
    `getByCateAndSlug` flow.
12. `note.controller.ts` — switch to `NoteMetaBuilder`.
13. Faux e2e: response envelope assertions confirm `skills` lands on
    `meta.skills`, not `data.skills`.

### Stage C — api-client (package)

14. `packages/api-client/src/response/meta.types.ts` re-export the
    per-resource types. Mark `ResponseMeta` as `@deprecated`.

### Stage D — Yohaku no-merge cleanup

15. `lib/api/article-meta.ts` — new helpers.
16. `lib/api/meta.ts` — delete `withArticleMeta`,
    `withPaginatedArticleMeta`, related types.
17. `lib/api/meta.test.ts` — rewrite.
18. `queries/definition/post.ts`, `queries/definition/note.ts` — return
    `{ data, meta }`.
19. Stores / selector hooks reshape.
20. Consumer file edits (~20 files).
21. Component prop reshapes.
22. Update test fixtures.

## Testing

| Layer                    | Tests                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Snippet bundle service   | Bundle view construction, prefix query, asset ordering, private filtering, batched query.                      |
| Snippet import           | Transactional rollback (invalid frontmatter mid-batch), upsert on existing path, idempotent re-push.           |
| Meta builder             | Per-resource schema parse, method type inference, base method inheritance.                                     |
| Post controller faux e2e | `GET /posts/:cat/:slug`: `skills` absent from `data`, `meta.skills` shape correct, manifest reflects fixtures. |
| Note controller faux e2e | `NoteMetaBuilder.summary()` flows into `meta.summary`.                                                         |
| Wire byte-pin            | post detail JSON fixture before / after — `skills` location moves but rest of envelope identical.              |
| Yohaku unit              | `articleMetaOf()` extraction; `PostNoticeCard` renders skill list.                                             |
| Yohaku e2e               | Post detail renders skills card if backend mock includes `meta.skills`.                                        |

## Wire Compatibility

### Breaking changes

- `GET /posts/latest` and `GET /posts/:category/:slug`: `data.skills`
  removed; `meta.skills` added. Public consumers reading `post.skills`
  break.
- `PublicSkillView` removed in favour of `SkillBundleView` (renamed +
  new `assets[]`; `raw` removed).

### Soft-degrade behaviour

- Old Yohaku frontend running against new mx-core backend: `data.skills`
  is `undefined`; the existing `data.skills ?? []` guard prevents
  crashes. Skill card simply does not render. Acceptable as a transient
  state during deploy.
- New Yohaku frontend running against old mx-core backend: `meta.skills`
  is `undefined`; skill card does not render. Same soft-degrade.

### Compat plan

All stages ship in a single PR, but they land on `mx-core` and `Yohaku`
as separate repository commits. Deploy order:

1. mx-core merge & deploy (Stages A–C). At this moment the production
   Yohaku is still running the old frontend that reads `data.skills`.
2. Yohaku merge & deploy (Stage D).

Between (1) and (2) — the deploy window, typically minutes — the old
Yohaku frontend sees `data.skills === undefined` and the skill notice
card silently disappears. Acceptable: skill attachment is a low-traffic
feature, and the window is short.

To eliminate the window entirely, ship a temporary one-line bridge in
Stage D's first commit: add `skills: meta?.skills` to `withArticleMeta`
*before* the helper is deleted. Then delete the helper in the same PR's
subsequent commits. This is optional and only worth doing if the deploy
windows can't be sequenced tightly.

### Rollback strategy

- If Yohaku Stage D regresses: revert Yohaku's Stage D commits only. The
  mx-core changes stay in place; Yohaku temporarily soft-degrades (skill
  card hidden) until a fix lands.
- If mx-core changes regress: revert the mx-core commits. Yohaku Stage D
  must also be reverted because it depends on the new wire shape.

## Documentation

- This spec: `docs/superpowers/specs/2026-06-19-skill-bundle-and-meta-builder-design.md`.
- `apps/core/CLAUDE.md` gains a new section "Response meta — per-resource
  builders" describing the base / Post / Note split, the rule that
  resource-attached metadata lives on `meta` not `data`, and the
  forbidden anti-pattern `{ ...entity, attachedField }` returning
  through `withMeta`.
- `apps/core/src/modules/snippet/CLAUDE.md` (or the closest existing
  CLAUDE.md covering snippet) gains a note on `SkillBundleView`,
  `findSkillBundlesByIds`, and the transactional `POST /snippets/import`.
- CHANGELOG: mark "Skill bundle distribution — `data.skills` → `meta.skills`,
  manifest now lists assets" as a breaking change.

## Open Questions

None blocking. The following are deferred:

- Binary asset support (images in skill bundles).
- A `/skills` index page on Yohaku enumerating all attached skills.
- Skill versioning, signing, or trust cards.
- Standalone skill page rendering the asset tree (currently shows root
  markdown only).
