# Wave 2 Pass B — Atomic Cut Execution Playbook

Date: 2026-05-02
Branch: `codex/postgresql-snowflake-migration-spec`
Predecessors: `2026-05-02-postgres-migration-session-4.md`

> **TL;DR.** Wave 2 Pass A landed (commit `be524594`) — content
> repositories grew batch methods. Pass B is the **atomic cut** of
> seven producer modules (post, note, page, comment, category,
> recently, draft) plus every consumer that touches `<svc>.model` or
> `@InjectModel` of those classes. Build must stay green between
> commits, but Pass B is by structural necessity a **single commit**.
> Total surface: ~30 files, ~10K LOC, ~155 call-site rewrites,
> 23 DI swaps. Estimated 1–2 focused sessions.

---

## 1. Why one commit

The dependency graph forbids partial cuts:

- `post.categoryId` is `bigint` FK in PG schema; while post is on
  Mongo it stores `ObjectId` strings. Cutting `category` alone breaks
  `postModel.populate('category')`.
- `comment.refId` / `recently.refId` / `draft.refId` are polymorphic
  `bigint` FKs to post/note/page. Cutting any leg leaves the others
  pointing at unreachable IDs.
- `database.service.findGlobalById` queries post+note+page+recently
  in parallel and unifies results. Mixed Mongo+PG kills it.
- `aggregate.service` and `search.service` join across all seven
  producers; staggered cut makes them unfixable.

So the cut is one logical state transition. Stage everything
locally, run tsc + the 32-test PG suite + a manual server boot,
then commit as one.

---

## 2. Producer modules — DI swap matrix

For each producer, the change pattern is identical:

1. Drop `@InjectModel(XModel)` from constructor.
2. Inject `private readonly xRepository: XRepository`.
3. Remove the `get model()` getter on the service.
4. Move every internal method body from Mongoose to the repository.
5. Module file: add `XRepository` to providers; export it if any
   cross-module consumer reads via `xService.repository.X` (rare —
   prefer named methods).

| Producer | service.ts | controller.ts | extra | repo coverage |
|----------|------------|---------------|-------|---------------|
| category | 267 lines | 205 lines | – | `category.repository.ts` 230 lines — verify gap §3.1 |
| page | 193 | 258 | – | `page.repository.ts` 174 (Pass A added findRecent/findManyByIds) |
| post | 479 | 446 | – | `post.repository.ts` 401 (Pass A added count/findRecent/findManyByIds/findAdjacent/findArchiveBuckets) |
| note | 624 | 748 | – | `note.repository.ts` 364 (Pass A added count/countVisible/findRecent/findManyByIds/findAdjacent/getLatestVisible) |
| comment | 1248 | 469 | `comment.lifecycle.service.ts` 460 | `comment.repository.ts` 446 (Pass A added countByState/findRecent/findManyByIds/findByRefIds/deleteForRef/updateStateForRef/updateStateBulk) |
| recently | 406 | ~137 | – | `recently.repository.ts` 198 (Pass A added count/findRecent) |
| draft | 303 | 144 | – | `draft.repository.ts` 240 — verify gap §3.2 |

### 2.1 Producer call sites left to migrate inside the producer itself

After Pass A, producer services still reach into other producers'
`.model`. List from `rg "Service\.model" modules/` post-Pass-A:

- `category.service.ts` — 8 calls into `postService.model`:
  - `findCategoryById` line 59 — countDocuments({categoryId})
    → `postRepository.countByCategoryId(categoryId)`
  - `findAllCategory` line 75 — countDocuments({categoryId: id})
    → `postRepository.countByCategoryId(id)`
  - `getPostTagsSum` line 91 — aggregate (tags unwind)
    → `postRepository.aggregateAllTagCounts()` (new method — see §3.1)
  - `getCategoryTagsSum` line 109 — aggregate (categoryId match → tags)
    → `postRepository.aggregateTagCountsByCategory(categoryId)`
  - `findArticleWithTag` line 126 — find by tag
    → `postRepository.findByTag(tag, {includeCategory: true})`
  - `findCategoryPost` line 167 — find by categoryId
    → `postRepository.listByCategory(categoryId, {select, sort})`
  - `findPostsInCategory` line 178/199 — find by categoryId
    → `postRepository.findByCategoryId(categoryId)`

- `note.service.ts` line 540 — `commentService.model.deleteMany`
  for ref cleanup → `commentRepository.deleteForRef('Note', noteId)`
  (Pass A method).

- `post.service.ts` line 409 — `categoryService.model.findOne({slug})`
  → `categoryRepository.findBySlug(slug)`.

- `recently.service.ts` lines 237 & 289 —
  `commentService.model.countDocuments`/`deleteMany`
  → `commentRepository.countByRef('Recently', id)` (need new method)
  + `commentRepository.deleteForRef('Recently', id)` (Pass A).

### 2.2 Controllers

Each producer controller currently calls `<svc>.model.X(...)`. Map
each:

#### `category.controller.ts`
- L64 `postService.model.find({categoryId})` →
  `postRepository.listByCategory(categoryId)`.
- L113/117 `categoryService.model.findOne({slug or _id})` →
  `categoryRepository.findBySlug(slug)` / `findById(id)`.
- L131 `postService.model.countDocuments({categoryId})` →
  `postRepository.countByCategoryId(id)`.
- L186 `categoryService.model.findById(id)` →
  `categoryRepository.findById(id)`.

#### `page.controller.ts`
- L66 `pageService.model.paginate(...)` → `pageRepository.list(page, size)`.
- L148/166 `pageService.model.findOne({slug})` →
  `pageRepository.findBySlug(slug)`.
- L218 `pageService.model.findById(id).lean()` →
  `pageRepository.findById(id)`.
- L240 `pageService.model.updateOne(...)` →
  `pageRepository.update(id, patch)`.

#### `post.controller.ts`
- L77/79 `postService.model.find/aggregate` (list with category
  populate) → `postRepository.list(page, size, {hideUnpublished})`
  with `attachCategory` mirror of note.repository's `attachTopic`.
- L92 `new this.postService.model.base.Types.ObjectId(id)` — gone;
  use `parseEntityId`.
- L226 `postService.model.findOne({slug})` →
  `postRepository.findBySlug(slug)`.
- L247 / L284 — see post.repository's existing methods for adjacency
  and slug lookup.

#### `note.controller.ts`
- L142/152 prev/next — `noteRepository.findAdjacent('before'|'after',
  {nid: pivot.nid}, {visibleOnly})` (Pass A).
- L245 `paginate` → `noteRepository.listVisible(page, size)` or new
  `listAll(page, size)` for admin.
- L381/459/470/485 — slug/nid/id lookups → repository methods.
- L644 — like find by id → `noteRepository.findById(id)`.

#### `comment.controller.ts`
- L207 `findOne({...}).populate(...)` →
  `commentRepository.findByIdWithRelations(id)` (new method §3.3).
- L357 ref lookup → repository.
- L366/378/417/419 `updateMany` →
  `commentRepository.updateStateBulk(ids, state)` (Pass A) and
  related ref updates.
- L438 `find(filter)` → repository helper for admin filter (paginated
  list-by-state).
- L460 `findById(id)` → `commentRepository.findById(id)`.

#### `recently.controller.ts`
- All `recentlyService.model.X` calls → `recentlyRepository`
  (list/findById/create/update/delete).

#### `draft.controller.ts`
- L41 list `find(filter).sort` → `draftRepository.list(page, size,
  filter)` (verify gap §3.2).
- L47 `countDocuments(filter)` → `draftRepository.count(filter)`.

---

## 3. Repository gaps to close before the cut

Pass A added the cross-producer batch helpers needed by aggregate /
search / etc. The cut adds these last gaps **first**, in a small
"Pass A.5" prep commit, before the big Pass B commit:

### 3.1 `category.repository.ts` and `post.repository.ts` gaps
- `categoryRepository.findBySlug(slug)` — should already exist; verify.
- `postRepository.countByCategoryId(categoryId)` — `count(*)
  where categoryId = $1`.
- `postRepository.aggregateAllTagCounts()` — returns
  `{name: string, count: number}[]`. SQL:
  `select unnest(tags) as name, count(*) from posts
   group by name`.
- `postRepository.aggregateTagCountsByCategory(categoryId)` —
  same with `where categoryId = $1`.
- `postRepository.findByTag(tag, options)` — `where tag = ANY(tags)`.
- `postRepository.listByCategory(categoryId, options)` — with select
  + sort.
- `postRepository.findByCategoryId(categoryId)` — full rows.
- `postRepository.attachCategory(row)` — mirror `note.attachTopic`.

### 3.2 `draft.repository.ts` audit
Verify these exist; add if missing:
- `list(page, size, filter)` — paginated list.
- `count(filter)`.
- `findByRef(refType, refId)` — already used by note/page/post
  service for "draft for this published".
- `linkToPublished(draftId, publishedId, refType)` — used during
  publish.

### 3.3 `comment.repository.ts` final gaps
- `findByIdWithRelations(id)` — fetch comment + parent + children
  refs needed for admin detail view.
- `countByRef(refType, refId)` — count comments for a ref (recently
  uses this to maintain commentsIndex).
- `paginatedFind(filter)` — admin-side filter / sort / paginate.

---

## 4. Consumer modules

### 4.1 `database.service.ts` (processors/database)
**Critical, central.** Currently injects 4 Mongoose models for
`getModelByRefType`, `findGlobalById`, `findGlobalByIds`,
`flatCollectionToMap`.

Replace with a `ContentRepositoryRouter` provider, or fold the
methods into a new `~/processors/database/content.service.ts` that
takes `PostRepository`, `NoteRepository`, `PageRepository`,
`RecentlyRepository`. Public surface stays the same; callers use
`databaseService.findGlobalById(id)` as before, but the implementation
is now PG-backed (parseEntityId + parallel repository.findById).

Watch out for: `databaseService.db` and
`databaseService.mongooseConnection` are still consumed by
serverless's `mockDb` / `mockGetOwner`. Wave 3 deletes those; for
wave 2 keep the getters returning a no-op or throw "removed in PG
mode" with a clear migration message — log + fallback.

### 4.2 `aggregate.service.ts` (819 lines, 37 sites)
Strategy: rewrite each method top-to-bottom against repositories.
The MongoDB aggregation pipelines that collect tag counts,
category counts, year-month archives all have direct PG SQL
equivalents — most already lifted into repository methods (Pass A
added `findArchiveBuckets`, etc.). For the remaining pipelines
(`getAllByYear`, `getCountInLastDays`, `getRefTypeQuery` switches),
add named methods on the producer repository rather than smuggling
SQL into the service.

Key call-site map:
- L84/268 `pageService.model.find({})` → `pageRepository.findAll()`
  (existing).
- L109/120/135 timeline-recent (sort by created desc, limit) →
  `<noteRepository|postRepository|recentlyRepository>.findRecent(size,
  {visibleOnly|publishedOnly: !isAuthed})`.
- L146/170 visible recent → repository `findRecent` with visible flag.
- L216/232/280/315/359/365 archive bucketing →
  `<repo>.findArchiveBuckets()` (Pass A on post; note/recently need
  their own — add to playbook gap list).
- L451-468 `countDocuments` for stats → `<repo>.count()` /
  `countVisible()`.
- L455/459/462 comment counts by state →
  `commentRepository.countByState(state, rootOnly?)`.
- L543/549/589/590 `aggregate(pipeline)` (top-N tags/category) →
  add `<repo>.topTagsByCount(limit)` / `topCategoriesByCount(limit)`.
- L608/611 oldest record (`findOne({}, 'created', {sort: 1})`) →
  `<repo>.findOldest()` (new tiny method).

### 4.3 `search.service.ts` (842 lines, 9 sites)
BM25 stays JS-side. Persistence reads switch to:
- L103/109/113 source content fetch (post/page/note bulk fetch by
  ids) → `findManyByIds(ids)` (Pass A).
- L436/446/475 `find({_id: {$in: idsByType.X}})` → same
  `findManyByIds`.
- L539/547/555 single source row by id → `<repo>.findById(id)`.

### 4.4 `comment.lifecycle.service.ts`
Already partly cut (snippet/serverless). Remaining post/note/page
references during ref-resolve and notification enrichment switch
to `<producerService>.findById(id)` named methods (do **not** route
through `<svc>.repository` for arms-length consumers — add named
methods on the service like `postService.findById(id)`,
`noteService.findById(id)`, `pageService.findById(id)`).

### 4.5 Other consumers

- `markdown.service.ts` (`@InjectModel` for Category/Post/Note/Page) —
  replace 4 model fields with 4 repositories. Each `find()` in markdown
  export maps to `<repo>.findAll()` or `findRecent`.

- `feed.service.ts` / `sitemap.service.ts` — read-only listing.
  Swap to repositories.

- `helper.event-payload.service.ts` — `findById(...).populate(...).
  lean({getters: true})` — replace each case with
  `postService.findById(id)` (which itself returns
  `attachCategory(row)` from the repository) etc.

- `helper.controller.ts` (debug?) — L66/67/68 `postService.model.find()`
  / `noteService.model.find()` / `pageService.model.find()` —
  swap to `<svc>.repository.findRecent(N)` or admin-only
  `findAll()`.

- `file.controller.ts` L66/72 — `fileReferenceService.model` —
  this is **wave 3** territory (file_reference table) — leave alone,
  it does not block wave 2.

- `activity.service.ts` L537/673/681 — comment + post + note model
  reads → `<repo>.findById` and `findRecent`. Activity is wave 3
  but these three call sites must update because the producers cut.

- `ai-translation/translation-entry.service.ts` — `@InjectModel
  (CategoryModel)` + `@InjectModel(NoteModel)` — swap.

- `ai-writer/ai-slug-backfill.service.ts` — `@InjectModel(NoteModel)`
  — swap.

- `cron-task/*` — if it queries content models, swap. Audit before cut.

- `update.service.ts` — same audit.

- `slug-tracker.service.ts` — audit; recently the producer of slug
  trackers, may not consume content models directly.

---

## 5. Verification gates

### 5.1 Compile

```bash
cd apps/core
SNOWFLAKE_WORKER_ID=1 ./node_modules/.bin/tsc -p tsconfig.json --noEmit
# silent — green
```

If anything fails, do not commit.

### 5.2 Tests

```bash
cd apps/core
SNOWFLAKE_WORKER_ID=1 PG_VERIFY_URL=postgres://mx:mx@127.0.0.1:54329/mx_core_verify \
  ./node_modules/.bin/vitest run --no-file-parallelism \
  test/src/shared/id test/src/database test/src/modules/category
# Test Files  4 passed (4)
# Tests       32 passed (32)
```

Wave 2 Pass B should also unbreak any further test files (e.g.
test/src/modules/post if it exists). Confirm zero new failures.

### 5.3 Server boot smoke

Per session-3 doc §6: boot a PG-only server in this worktree using
the migrated verify container, hit:
- `GET /api/v2/says/all`
- `GET /api/v2/posts`
- `GET /api/v2/notes`
- `GET /api/v2/pages`
- `GET /api/v2/aggregate/top`
- `GET /api/v2/search?q=foo`

Each should return shaped data with `id` (decimal) and
`created_at` (ISO).

### 5.4 Commit

One commit titled `feat(content): cut over post/note/page/comment/
category/recently/draft to PostgreSQL`. Body should list every
file touched and verify the boot smoke succeeded.

After the cut:
- Run `grep -rn "MongoIdDto" apps/core/src/modules/{post,note,page,
  comment,category,recently,draft}` — expect zero hits.
- Run `grep -rn "@InjectModel" apps/core/src` — expect only the
  wave 3/4 modules (auth, ai, ops, file_reference, etc.).
- Run `grep -rn "Service\.model\b\|Service\.model\." apps/core/src` —
  expect zero hits in cut modules; wave 3 modules may still have
  some.

---

## 6. Suggested executor

Codex via `codex exec` (or codex:rescue subagent in worktree
isolation). The work is mechanical given §2-§5; the agent benefits
from the existing repository methods landed in Pass A and the
mapping table in §2.

**Brief template** for the executor:

> Read `docs/superpowers/specs/2026-05-02-postgres-migration-wave-2-
> playbook.md` and execute the cut described in §2-§5. Do NOT
> deviate from the producer / consumer lists. Add repository
> methods listed in §3 first as a prep commit. Then do the atomic
> cut as one commit. Verify with §5 gates before each commit. Keep
> `databaseService.db` getter returning the existing Mongoose db
> for now — wave 3 removes it. Do NOT add AI co-authorship.

**Out of scope for Pass B** (do not touch):
- `auth/*`, `owner/*`, `reader/*` (wave 4)
- `ai-summary`, `ai-insights`, `ai-agent`, AI runtime (wave 3)
- `file/file-reference.*`, `webhook/*`, `serverless/*` (wave 3)
- `poll/*`, `meta-preset/*`, `option/*`, `configs/*` (wave 3)
- `cron-task/*` if it does not call content models (audit first)
- Mongo bootstrap files (`databaseModels` array) — wave 5 deletes

---

## 7. Open commitments

1. The atomic cut delivers wave 2 in one mechanical pass. After
   landing, runtime is ~50% PG (wave 1 + 2). Waves 3-5 remain.
2. Once Pass B lands, the user should test against real data using
   the migration CLI: `tsx apps/core/src/migration/postgres-data-
   migration/runner.ts`. Re-verify content browsing end-to-end.
3. Frontends (`../admin-vue3`, `../Shiroi`) absorb the `id` /
   `created_at` shape change after this branch merges — backend-only
   scope still applies.
