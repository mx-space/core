# PostgreSQL Migration — Session 4 Status & Continuation Plan

Date: 2026-05-02
Branch: `codex/postgresql-snowflake-migration-spec`
Predecessors:
`2026-05-02-postgresql-snowflake-migration-design.md`,
`2026-05-02-postgres-migration-handoff.md`,
`2026-05-02-postgres-migration-session-3.md`.

> **TL;DR.** Foundation, schema, 28 repos, migration CLI,
> `BasePgCrudFactory`, and wave 1 of the cutover (project, topic,
> subscribe, say, link, **snippet**) are committed. Snippet pulled in
> ServerlessService / DebugController / CommentLifecycleService in the
> same commit because of `serverlessService.model` cross-module reads.
> Wave 1 *cannot* include `draft` — `drafts.refId` is a `bigint` FK to
> posts/notes/pages, but those modules still hold Mongo `_id` hex
> strings at runtime, so draft cutover is gated on post/note/page in
> wave 2. **Backend-only scope** — frontends (`../admin-vue3`,
> `../Shiroi`) absorb the `id` / `created_at` shape change after the
> backend lands.

---

## 1. Decisions locked this session

The user delegated all six remaining open decisions ("只做后端，其他都
看你决定"). These supersede §7 of the previous handoff and are not up
for re-litigation:

### 1.1 API compatibility — backend-only release

The backend lands first on this branch. Frontends will see `id` /
`created_at` instead of `_id` / `created` for cut endpoints; that
breakage is accepted and patched in the frontend repos after this
branch merges. **Do not block backend cutover on frontend coordination.**

### 1.2 Auth schema — regenerate `0000_initial.sql`

Wave 4 will switch `readers` / `accounts` / `sessions` / `api_keys` /
`passkeys` / `verifications` / `owner_profiles` PKs from `bigint` to
`text` (Better Auth requirement). Path: regenerate the initial drizzle
migration, drop the existing PG verify container, re-run the migration
CLI on a fresh container. **Do not write a follow-up `0001_*.sql`** —
the migration CLI is the source of truth and the verify container is
ephemeral; clean schema is more valuable than preserving partial data.

### 1.3 `mongo_id_map` for auth tables — separate `auth_id_map` table

Add a dedicated `auth_id_map(collection text, mongo_id text, pg_id text,
created_at timestamptz)` table. Auth-table identity is preserved by
storing the Mongo ObjectId hex string directly as the PG `id`, so this
map exists for forensic chasing only (e.g. tracing API-key links from
admin logs). `mongo_id_map.snowflake_id` keeps its `bigint` semantics
for content tables — do not reuse it for hex-string ids.

### 1.4 Snippet `POST /aggregate` — hard 400 + deprecation message

Endpoint accepted arbitrary Mongo aggregation pipelines from request
bodies; that surface is fundamentally un-portable. Live state:
controller throws `BizException(InvalidParameter, '… is removed in
PostgreSQL mode. Use GET /snippets/group or /snippets/group/:reference
instead.')`. Admin UI must drop any usage. (HTTP 400 instead of 410
because BizException maps to 400 in this codebase by default; the
*message* is the contract, the status code is incidental.)

### 1.5 Single PR

Continue on one branch, one PR. Do not split into stacked PRs even as
the diff grows. The change set is one logical unit ("replace runtime
storage backend"); reviewers absorb it in one pass.

### 1.6 Backup format — drop the old reader

Wave 5 backup tool ships with `pg_dump --format=custom` /
`pg_restore` only. Do not retain a Mongo-backup reader for one
release; old backups are restored via the migration CLI against a
fresh PG instance, not via the backup tool.

### 1.7 `docker-compose.yml` — remove `mongo:` outright

In wave 5, delete the `mongo:` service from both `docker-compose.yml`
and `docker-compose.server.yml`. No commented-out grace period. Local
dev that needed Mongo for a one-time migration can boot a temporary
container via `docker run` directly.

---

## 2. What session 4 added

### 2.1 Snippet cutover (commit `c9c6ef74`)

Files touched (10):

- `apps/core/src/modules/snippet/snippet.repository.ts` — adds `secret`
  column to `SnippetRow`; new methods `findPublicByName`,
  `findFunctionByCustomPath`, `findFunctionByCustomPathPrefix`,
  `findFunctionByNameReference`, `findFunctionsByNamesReferences`,
  `countByNameReferenceMethod`, `countByCustomPath`,
  `groupByReference`, `list(page, size)`, `listGrouped(page, size)`,
  `updateByName`. Drops the previous `list({type, reference, …})`
  signature.
- `apps/core/src/modules/snippet/snippet.service.ts` — DI swaps from
  `@InjectModel(SnippetModel)` to `SnippetRepository`. `secret` is
  `EncryptUtil.encrypt`-ed on write. `transformLeanSnippetModel` keeps
  the historical mask-and-decrypt-on-read behaviour. The legacy
  `SnippetModel`-typed shape is replaced by `SnippetRow` everywhere.
- `apps/core/src/modules/snippet/snippet.controller.ts` — full rewrite
  to use `repository.list / listGrouped / findAll(reference)`. The
  `POST /snippets/aggregate` endpoint now throws a deprecation error
  (decision 1.4). `MongoIdDto` route params switch to `EntityIdDto`.
- `apps/core/src/modules/snippet/snippet-route.controller.ts` — type
  change `SnippetModel` → `SnippetRow`; `let cached = null; if/else`
  collapsed to a ternary so eslint is happy.
- `apps/core/src/modules/snippet/snippet.module.ts` — registers
  `SnippetRepository` in providers and exports both the service and
  the repository (the repository is consumed cross-module by
  `ServerlessService`).
- `apps/core/src/modules/serverless/serverless.service.ts` —
  `@InjectModel(SnippetModel)` removed; `private readonly
  snippetRepository: SnippetRepository`. `compileTypescriptCode`
  backfill, `pourBuiltInFunctions`, `isBuiltInFunction`,
  `resetBuiltInFunction`, `injectContextIntoServerlessFunctionAndCall`,
  `saveInvocationLog` all rewritten to consume the repository.
  **`ServerlessLogModel` and `databaseService.db` (mockDb /
  mockGetOwner) intentionally remain on Mongoose** — they belong to
  the wave 3 ops batch.
- `apps/core/src/modules/serverless/serverless.controller.ts` —
  `/compiled/:id`, `/:reference/:name`, `/reset/:id` swap from
  `serverlessService.model.X` to repository methods. `MongoIdDto` → 
  `EntityIdDto`.
- `apps/core/src/modules/serverless/serverless.module.ts` — adds
  `imports: [forwardRef(() => SnippetModule)]` to break the import
  cycle between Snippet and Serverless.
- `apps/core/src/modules/comment/comment.lifecycle.service.ts` —
  `appendIpLocation` swaps `serverlessService.model.findOne(...)`
  for `serverlessService.repository.findFunctionByNameReference('ip',
  'built-in')`.
- `apps/core/src/modules/debug/debug.controller.ts` —
  `runFunction` constructs a `SnippetRow`-shaped temporary object
  instead of `new SnippetModel()`.

**Verification (locally, this worktree):**

```bash
cd apps/core
SNOWFLAKE_WORKER_ID=1 ./node_modules/.bin/tsc -p tsconfig.json --noEmit
# silent — green
SNOWFLAKE_WORKER_ID=1 PG_VERIFY_URL=postgres://mx:mx@127.0.0.1:54329/mx_core_verify \
  ./node_modules/.bin/vitest run --no-file-parallelism \
  test/src/shared/id test/src/database test/src/modules/category
# Test Files  4 passed (4)
# Tests       32 passed (32)
```

### 2.2 Why `draft` slipped to wave 2

Service-level `DraftService.linkToPublished(draftId, publishedId)`,
`findByRef(refType, refId)`, etc. are called by `note.service.ts`,
`page.service.ts`, `post.service.ts` — those services pass their own
mongoose `doc.id` (Mongo ObjectId hex strings) as `publishedId`. The
PG `drafts.refId` column is `bigint`. Without a runtime
`mongo_id_map` lookup (and there is no plan to build one), draft
cannot accept hex strings while its consumers are still on Mongo. So
the cleanest cutover is "post + note + page + draft together" inside
wave 2.

`SnippetRepository` already has `findFunctionsByNamesReferences` which
makes `pourBuiltInFunctions` cheap; no analogous repo addition is
needed for draft yet — that work happens in wave 2.

### 2.3 Task tracker

```
#74 [pending] Wave 1 finish: cut over draft to PG
        DEFERRED to wave 2 — see §2.2 above.
#75 [completed] Wave 1 finish: cut over snippet to PG
#76 [in_progress] Record session-4 decisions in handoff doc
```

---

## 3. Wave 2 — what comes next

### 3.1 Scope

Wave 2 is the largest single batch. It must compile end-to-end as one
unit because the cross-module mesh (see §3 of session-3 doc) does not
allow partial cuts. Modules to flip together:

- `category` (consumed by post.service)
- `page`
- `recently`
- `post`
- `note`
- `comment` + `comment.lifecycle.service`
- `draft` + `draft-history`
- `aggregate`
- `search`
- AI consumers that read post/note/page directly: `ai-summary`,
  `ai-insights`, `ai-translation`, `ai-agent`
- Read-only consumers that emit feeds/sitemap/markdown:
  `feed`, `sitemap`, `markdown`
- `slug-tracker` (cross-cuts post/note/page)
- `cron-task` (calls into post/note/comment)
- `update` (consumes content tier)
- `helper.event-payload.service.ts` in `~/processors/helper/` —
  `lean({ getters: true })` over post/note/page models

`databaseService.findGlobalById` / `findGlobalByIds` — these remain
on Mongo until wave 3 because they iterate `databaseModels`. Do not
attempt to rewrite in wave 2; instead, callers that already know the
table type should use the typed repository directly.

### 3.2 Cross-module audit at wave 2 entry

Run before starting:

```bash
cd apps/core/src
grep -rEn "this\.[a-z]+Service\.model\b|this\.[a-z]+Service\.model\." modules/
grep -rln "@InjectModel" modules/
```

Expected hot spots after session 4:

- `aggregate.service.ts` — ~40 calls into post/note/page/comment/
  recently model (must rewrite all in this wave).
- `comment.service.ts` (1248 lines) — `databaseService.getModelByRefType`
  switch dispatching to post/note/page/recently. Rewrite to a
  repository switch.
- `comment.lifecycle.service.ts` — already partly cut in §2.1 for the
  serverless `ip` lookup; remaining post/note/page references migrate
  here.
- `search.service.ts` (842 lines) — BM25 stays JS; persistence reads
  swap to `SearchRepository` and consumers fetch source content via
  post/note/page repositories.
- `feed/sitemap/markdown` — repository `findAll` / `find` reads.
- `helper.event-payload.service.ts` — `postModel.findById` etc.;
  swap to repository.

### 3.3 Pattern reminders from sessions 2–4

- Producer + every consumer in **one commit**. Do not push a half-cut
  wave; build must stay green between commits.
- For each `<svc>.model.X` consumer call site, add a named method on
  the producer service, not a public `.repository` getter at the
  cross-module boundary. `serverlessService.repository.X` was
  acceptable in §2.1 only because Serverless and Snippet are tightly
  coupled; for arms-length consumers (aggregate, search, feed) prefer
  `<svc>.findRecentX(...)` named methods so future implementation
  swaps don't ripple again.
- `MongoIdDto` route params → `EntityIdDto`. Run a final
  `grep -rn "MongoIdDto" modules/` before commit to confirm zero
  remaining in cut modules.
- Mongo model files (`*.model.ts`) **stay**: the `databaseModels`
  array in `~/processors/database/database.models.ts` still references
  them; deleting them breaks Mongo bootstrap. They get removed in
  wave 5 alongside the `databaseProvider` itself.
- `JSONTransformInterceptor` snake-cases response keys but does not
  rename `id` to `_id`; the response shape contract for cut endpoints
  is `{ id, created_at, ... }`.

### 3.4 Subagent strategy

Wave 2 is too large for a single linear pass. Recommended split when
the time comes:

1. **Pass A** (single agent): build the necessary repository methods
   on every content repo so wave-2 services can compile. No service
   rewrites yet.
2. **Pass B** (parallel agents, isolation: `worktree`): each agent
   takes one module pair (e.g. `category + post`,
   `aggregate + search`, `note + comment`) on its own worktree,
   verifies tsc + 32 tests, commits. Merge order in the parent
   branch is fixed (category → post → note → page → comment → draft →
   recently → aggregate → search → AI → feed/sitemap/markdown).
3. **Pass C** (single agent): integration verification. Boot the
   server PG-only (per §6 verification block of session-3 doc);
   curl-smoke `/says/all`, `/posts`, `/notes`, `/aggregate/top`,
   `/search`. If anything breaks, fix in this pass.

Do **not** attempt to send Pass B agents loose without first
landing Pass A — they will collide on repository signatures.

---

## 4. Open commitments to the user

1. The user reaffirmed "完全跑通" (fully runnable end-to-end) as the
   exit bar. Session 4 added one wave-1 module; runtime is still
   ~85% Mongoose. Waves 2–5 must complete to honour the original
   commitment.
2. The user delegated all open decisions ("其他都看你决定，记得留文档")
   — §1 records them. They are locked.
3. The user asked the assistant to keep working ("开始继续剩下的迁移")
   — wave 2 begins next session unless the user pauses the work.
