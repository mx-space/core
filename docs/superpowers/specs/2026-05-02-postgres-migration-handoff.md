# PostgreSQL Migration Handoff (2026-05-02)

Companion to `2026-05-02-postgresql-snowflake-migration-design.md`. This file is
the source of truth for what has shipped on branch
`codex/postgresql-snowflake-migration-spec`, what is still pending, and how a
follow-up agent or engineer should pick the work back up.

The full migration described in the spec is multi-week work (≈ 7 PRs, ~30
modules). This document records the state at end of session 1 and gives the
next operator a concrete plan with file pointers.

## What is committed (verified)

| Commit | Scope | Status |
|---|---|---|
| `bcdaf76a` | Spec §18 Phase 0 decisions pinned. | ✓ done |
| `14f5bafa` | PR 1: `EntityId`, `SnowflakeGenerator`, `SnowflakeService`, app.config wiring, 21 unit tests. | ✓ done — `pnpm exec vitest run test/src/shared/id` passes 21/21. |
| `038ffa7d` | PR 2: 43-table drizzle schema, `0000_initial.sql`, `postgres.provider.ts`, repository token map, docker-compose `postgres:16-alpine` service, smoke spec. | ✓ done — `PG_VERIFY_URL=… pnpm exec vitest run test/src/database` passes 4/4 against an ephemeral PG container. |
| `4a534fbe` | PR 3 partial (1/2): `BaseRepository`, `CategoryRepository` (+ 7 integration tests), `TopicRepository`, `PageRepository`. | ✓ done. |
| `<batch 2>` | PR 3 partial (2/2): `PostRepository`, `NoteRepository`, `CommentRepository`, `ReaderRepository`. | ✓ done — `tsc -p tsconfig.json --noEmit` clean. |

## What is **not** done

- **No service-layer cutover yet.** Every service (`category.service.ts`,
  `post.service.ts`, …) still uses `@InjectModel(...)` against Mongoose. The
  repositories are wired into `DatabaseModule` but no consumer has switched
  over.
- **No auth migration (PR 4).** Better Auth still runs on the Mongo adapter.
- **No aggregate/search/AI/ops cutover (PR 5).** All AI/aggregate/serverless
  modules remain Mongo-only.
- **No Mongo → PG data migration tool (PR 6).** `mongo_id_map` /
  `data_migration_runs` tables exist in the schema but the CLI script is not
  written.
- **No Mongo cleanup (PR 7).** README, backup service, vitest helpers, and
  package dependencies still assume MongoDB at runtime.

## Phase 0 decisions (from spec §18)

These are fixed contracts that downstream work depends on:

- Worker ID: `SNOWFLAKE_WORKER_ID` env (or `--snowflake_worker_id`).
  Required in production, defaults to `0` in dev and `1` in tests.
- Snowflake epoch: `2026-05-02T00:00:00.000Z` (`1746144000000n`).
- `posts.read_count` / `like_count` / `notes.read_count` / `like_count` are
  physical `integer` columns; legacy nested `count` model is gone.
- `drafts.history` is a `jsonb` column. The `draft_histories` child table is
  pre-defined for future promotion but currently unused.
- `search_documents` keeps the denormalized term-frequency cache. `tsvector`
  is intentionally out of scope for the first cutover.
- Better Auth uses `@better-auth/drizzle-adapter` with `provider: 'pg'` against
  the same `pg.Pool` repositories share — verified compatible with
  `better-auth@^1.6.9`, `@better-auth/api-key@^1.6.9`, `@better-auth/passkey@^1.6.9`
  (see context7 query result in commit message of `038ffa7d`).
- Test infra replaces `mongodb-memory-server` with `@testcontainers/postgresql`
  + `postgres:16-alpine`. Local devs must have Docker.

## Repositories shipped (8/≈26)

```
apps/core/src/processors/database/base.repository.ts   ← shared helpers
apps/core/src/modules/category/category.repository.ts  ← canonical template
apps/core/src/modules/topic/topic.repository.ts
apps/core/src/modules/page/page.repository.ts
apps/core/src/modules/post/post.repository.ts
apps/core/src/modules/note/note.repository.ts
apps/core/src/modules/comment/comment.repository.ts
apps/core/src/modules/reader/reader.repository.ts
```

Each follows the same pattern:

1. Constructor takes `@Inject(PG_DB_TOKEN) AppDatabase` plus `SnowflakeService`.
2. Public methods accept `EntityId | string` for IDs and return rows whose
   `id` is `EntityId` (decimal string).
3. Internal SQL uses `bigint` exclusively. Conversion happens at the boundary
   via `parseEntityId` / `toEntityId` (see `base.repository.ts`).

## Repositories still to write (PR 3 + PR 5)

| Module | Schema entity | Notes |
|---|---|---|
| `recently` | `recentlies` | Polymorphic `ref_type`/`ref_id`. Mirror NoteRepository. |
| `draft` | `drafts` (+ `draft_histories` later) | Versioned save with history JSONB; service does diff math. |
| `search` | `search_documents` | Heavy bigram/term-frequency math; preserve current cache. |
| `aiSummary` | `ai_summaries` | Hash-keyed cache. |
| `aiInsights` | `ai_insights` | Includes self-FK for translation chain. |
| `aiTranslation` | `ai_translations` | Unique `(ref_id, ref_type, lang)`. |
| `translationEntry` | `translation_entries` | Path/lang/lookup-key composite key. |
| `aiAgentConversation` | `ai_agent_conversations` | Rich JSONB messages array. |
| `activity` | `activities` | Index on `created_at`, payload jsonb. |
| `analyze` | `analyzes` | High-volume time-series; partition later if needed. |
| `link` | `links` | Two unique columns. |
| `project` | `projects` | Simple. |
| `say` | `says` | Simple. |
| `snippet` | `snippets` | `customPath` partial unique. |
| `subscribe` | `subscribes` | Email + cancel-token unique. |
| `fileReference` | `file_references` | Polymorphic ref; status state machine. |
| `pollVote` | `poll_votes` + `poll_vote_options` | Multi-table aggregate. |
| `slugTracker` | `slug_trackers` | Used for slug rewriting. |
| `serverlessStorage` / `serverlessLog` | `serverless_*` | Per-fn isolation already enforced by namespace. |
| `webhook` / `webhookEvent` | `webhooks` + `webhook_events` | FK cascade. |
| `options` / `metaPreset` | `options`, `meta_presets` | Configuration tables. |
| Auth (PR 4) | `accounts`, `sessions`, `api_keys`, `passkeys`, `verifications`, `owner_profiles` | Better Auth owns most schema. Extend `ReaderRepository` and add `AuthRepository` per spec §12. |

## How a follow-up operator should proceed

### Step 1 — bring up local PG

```
docker compose up -d postgres
export PG_HOST=127.0.0.1 PG_USER=mx PG_PASSWORD=mx PG_DATABASE=mx_core SNOWFLAKE_WORKER_ID=1
```

### Step 2 — verify schema applies cleanly

```
PG_VERIFY_URL="postgres://mx:mx@127.0.0.1:5432/mx_core" \
  pnpm -C apps/core exec vitest run test/src/database test/src/modules/category
```

Both suites should pass. The provider applies migrations idempotently via
`drizzle-orm/node-postgres/migrator`, so re-runs are safe.

### Step 3 — add the next repository

Follow the template pattern from `category.repository.ts`:

1. Define `XxxRow` (id is `EntityId`), `XxxCreateInput`, `XxxPatchInput`.
2. Class extends `BaseRepository`. Constructor wires `PG_DB_TOKEN` + `SnowflakeService`.
3. Each public method translates `EntityId` ↔ `bigint` at the boundary.
4. Add to `POSTGRES_REPOSITORY_TOKENS` if you want symbol-based DI.
5. Register the repository class in the corresponding module's `providers`.
6. Write an integration spec under `apps/core/test/src/modules/<x>/<x>.repository.spec.ts`. Use the `PG_VERIFY_URL`-gated pattern from `category.repository.spec.ts`.

### Step 4 — service cutover

This is the largest remaining chunk. For each `xxx.service.ts`:

1. Replace `@InjectModel(XxxModel)` with `@Inject(POSTGRES_REPOSITORY_TOKENS.xxx) repository: XxxRepository`.
2. Translate every Mongoose call:
   - `model.findById(id)` → `repository.findById(id)`
   - `model.find(filter)` → repository finder method (add one if missing).
   - `model.aggregate(pipeline)` → SQL via repository (see `CategoryRepository.sumPostTags` for the pattern).
   - `model.populate('x')` → explicit join in the repository (see `PostRepository.attachCategory`).
3. Update controllers — most accept `MongoIdDto`; switch to `EntityIdDto`
   from `apps/core/src/shared/dto/id.dto.ts`. The legacy `MongoIdDto` is
   marked `@deprecated`; remove its uses in PR 7.
4. Update existing E2E tests to call the new endpoints. The `createE2EApp`
   helper still loads Mongoose models — once a module is fully cut over,
   replace its model registration with the repository provider.

### Step 5 — auth migration (PR 4)

Per spec §12. Replace the Mongo adapter at `apps/core/src/modules/auth/auth.implement.ts`:

```ts
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createPool, createDb } from '~/processors/database/postgres.provider'

const pool = await createPool()
const db = createDb(pool)
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  // … plugins (apiKey, passkey) unchanged
})
```

The schema already provides `accounts`, `sessions`, `api_keys`, `passkeys`,
`verifications`, `readers`, `owner_profiles` aligned to Better Auth's
adapter expectations. If Better Auth complains about column name mismatches,
update the schema in `apps/core/src/database/schema/auth.ts` (preferred)
rather than changing Better Auth conventions.

### Step 6 — data migration tool (PR 6)

Implementation-ready notes:

- Entrypoint: `apps/core/scripts/migrate-mongo-to-postgres.ts`.
- Phase 1: read every Mongo collection, allocate Snowflake IDs (use a
  dedicated migration worker ID range like 900–999), insert rows into
  `mongo_id_map` (`(collection, mongo_id) → snowflake_id`).
- Phase 2: load tables in the dependency order from spec §11 ("Migration
  Ordering"). Use a transaction per table.
- Phase 3: emit per-table count/missing-ref/duplicate-key/checksum reports
  to stdout and `data_migration_runs`.
- Failure policy from spec §11.4 must be enforced exactly.

### Step 7 — cleanup (PR 7)

- Remove `mongoose`, `@typegoose/*`, `mongoose-*`, `mongodb-memory-server`
  from `apps/core/package.json`.
- Remove `databaseProvider` (Mongo) from `database.module.ts`.
- Replace `mongodump`/`mongorestore` calls in `apps/core/src/modules/backup/backup.service.ts` with `pg_dump`/`pg_restore`.
- Update `apps/core/test/helper/db-mock.helper.ts` to use the testcontainer
  pattern instead of `mongodb-memory-server`.
- Update `README.md`, `apps/core/readme.md`, both `docker-compose*.yml`
  files (remove `mongo:` service).

## Smoke command reference

```bash
# Bring up an ephemeral PG only for verification:
docker run -d --name mx-pg-verify -e POSTGRES_USER=mx -e POSTGRES_PASSWORD=mx \
  -e POSTGRES_DB=mx_core_verify -p 54329:5432 postgres:16-alpine

# Run the existing PG-gated tests:
SNOWFLAKE_WORKER_ID=1 \
PG_VERIFY_URL="postgres://mx:mx@127.0.0.1:54329/mx_core_verify" \
  pnpm -C apps/core exec vitest run test/src/shared/id test/src/database test/src/modules/category

# Typecheck (clean as of last commit):
pnpm -C apps/core exec tsc -p tsconfig.json --noEmit

# Tear down:
docker rm -f mx-pg-verify
```

## Open questions discovered during PR 3 work

These were noted but not resolved; the next operator should decide:

1. **Polymorphic content lookup.** `DatabaseService.findGlobalById` currently
   queries Mongo posts/notes/pages/recentlies in parallel. The PG equivalent
   should live on `BaseRepository` as a helper that takes `(refType, id)`
   and routes to the right table. Skipped to avoid premature abstraction.
2. **Better Auth column names.** The schema in `auth.ts` uses snake_case
   names that match the spec. If Better Auth's PG adapter expects different
   camelCase column literals, regenerate via `drizzle-kit generate` after
   adjustment.
3. **`createE2EApp` testing helper.** The helper still mounts Typegoose
   models. Hybrid PG/Mongo modules will need either a per-module switch or a
   parallel `createPgE2EApp` helper. Decision deferred.
4. **Slug tracker default behavior.** Spec uses an optional unique index on
   `(slug, type)`. Schema currently leaves it non-unique because legacy data
   may contain duplicates; verify against real data before tightening.
