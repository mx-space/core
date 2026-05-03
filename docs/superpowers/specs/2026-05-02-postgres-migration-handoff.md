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
| `4a534fbe` | PR 3 batch 1: `BaseRepository`, `CategoryRepository` (+ 7 integration tests), `TopicRepository`, `PageRepository`. | ✓ done. |
| `973ed84a` | PR 3 batch 2: `PostRepository`, `NoteRepository`, `CommentRepository`, `ReaderRepository`. | ✓ done. |
| `<batch 3>` | PR 3 batch 3: 17 more repositories (link, project, say, recently, draft, options, activity, analyze, file-reference, subscribe, snippet, slug-tracker, webhook, poll-vote, serverless storage + log, ai-summary, ai-insights, ai-translation, translation-entries). | ✓ done. |
| `<batch 4>` | PR 3 batch 4 + PR 4 partial: `SearchRepository`, `AiAgentConversationRepository`, `AuthRepository`. | ✓ repositories done; auth.implement.ts adapter swap deferred. |
| `<PR 6>` | Mongo→PG migration CLI: `scripts/migrate-mongo-to-postgres.ts`, `src/migration/postgres-data-migration/{types,id-map,steps,runner}.ts`. | ✓ done; dry-run + apply modes; emits row count, missing-ref, and warning reports. |

## Repositories shipped (28 / 28 first-class tables)

PR 3 of the spec is repository-complete. Every first-class table has a
typed `Repository` class that:

1. Constructor takes `@Inject(PG_DB_TOKEN) AppDatabase` plus `SnowflakeService`.
2. Public methods accept `EntityId | string` for IDs and return rows whose
   `id` is `EntityId` (decimal string).
3. Internal SQL uses `bigint` exclusively. Conversion happens at the boundary
   via `parseEntityId` / `toEntityId` (see `base.repository.ts`).
4. Replaces every Mongoose call (`findById`, `populate`, `aggregate`,
   `lean`, `paginate`) with explicit drizzle SQL.

Located at:

```
apps/core/src/processors/database/base.repository.ts          ← shared helpers
apps/core/src/modules/category/category.repository.ts         ← canonical template
apps/core/src/modules/topic/topic.repository.ts
apps/core/src/modules/page/page.repository.ts
apps/core/src/modules/post/post.repository.ts
apps/core/src/modules/note/note.repository.ts
apps/core/src/modules/comment/comment.repository.ts
apps/core/src/modules/reader/reader.repository.ts
apps/core/src/modules/recently/recently.repository.ts
apps/core/src/modules/draft/draft.repository.ts
apps/core/src/modules/link/link.repository.ts
apps/core/src/modules/project/project.repository.ts
apps/core/src/modules/say/say.repository.ts
apps/core/src/modules/snippet/snippet.repository.ts
apps/core/src/modules/subscribe/subscribe.repository.ts
apps/core/src/modules/activity/activity.repository.ts
apps/core/src/modules/analyze/analyze.repository.ts
apps/core/src/modules/file/file-reference.repository.ts
apps/core/src/modules/poll/poll-vote.repository.ts
apps/core/src/modules/slug-tracker/slug-tracker.repository.ts
apps/core/src/modules/configs/options.repository.ts
apps/core/src/modules/serverless/serverless.repository.ts     ← storage + log
apps/core/src/modules/webhook/webhook.repository.ts           ← hooks + events
apps/core/src/modules/search/search.repository.ts
apps/core/src/modules/ai/ai-summary/ai-summary.repository.ts
apps/core/src/modules/ai/ai-insights/ai-insights.repository.ts
apps/core/src/modules/ai/ai-translation/ai-translation.repository.ts  ← + entries
apps/core/src/modules/ai/ai-agent/ai-agent-conversation.repository.ts
apps/core/src/modules/auth/auth.repository.ts                 ← accounts/sessions/api-keys/passkeys/verifications
```

Only `MetaPresetModel` is intentionally not yet ported because of the
deeply nested option/child schema; the Mongo model can stay until a
service explicitly needs it.

## What is **not** done

- **No service-layer cutover yet.** Every service (`category.service.ts`,
  `post.service.ts`, …) still uses `@InjectModel(...)` against Mongoose. The
  repositories are wired into `DatabaseModule` but no consumer has switched
  over. This is the largest remaining chunk.
- **No `auth.implement.ts` adapter swap (PR 4).** `AuthRepository` exists
  and the schema is in place; the actual `betterAuth({...})` call still uses
  `mongodbAdapter`. Replace with `drizzleAdapter(db, { provider: 'pg' })`
  and remove the bespoke `mongo-collection`-based hooks.
- **No `BasePgCrudFactory`.** Many simple modules (Say, Link, Project,
  Subscribe, Snippet, Say) inherit from `BaseCrudFactory` which is built on
  Mongoose. A repository-based mirror has to be written before those
  controllers can be cut over.
- **No Mongo cleanup (PR 7).** README, backup service, vitest helpers,
  `mongodb-memory-server`, and `mongoose`/`@typegoose` deps still ship.

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

## Repositories still to write

Only `MetaPresetRepository` remains. The model has nested `MetaFieldOption`
and `MetaPresetChild` arrays that map cleanly to `jsonb` columns once the
service no longer treats them as embedded sub-documents. Defer until the
service is being cut over.

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

### Step 6 — data migration tool (PR 6) — DONE

Implemented at:

- `apps/core/scripts/migrate-mongo-to-postgres.ts` (entrypoint).
- `apps/core/src/migration/postgres-data-migration/types.ts` — step contract.
- `apps/core/src/migration/postgres-data-migration/id-map.ts` — allocate / resolve helpers.
- `apps/core/src/migration/postgres-data-migration/steps.ts` — every collection step.
- `apps/core/src/migration/postgres-data-migration/runner.ts` — phase orchestration.

Run as:

```
SNOWFLAKE_WORKER_ID=900 \
MONGO_URI="mongodb://localhost:27017/mx-space" \
PG_URL="postgres://mx:mx@localhost:5432/mx_core" \
  pnpm -C apps/core exec tsx scripts/migrate-mongo-to-postgres.ts --mode dry-run
```

Then re-run with `--mode apply`. Apply mode persists `mongo_id_map` first
(safe to re-run), runs schema migrations, loads tables in dependency
order, and writes a row to `data_migration_runs`.

Steps the tool covers (in order): categories, topics, readers (+
owner_profiles), posts, notes, pages, recentlies, comments, drafts,
options, links, projects, says, snippets, subscribes, activities,
analyzes, file_references, poll_votes (+ poll_vote_options), slug_trackers,
webhooks (+ webhook_events), AI (summaries, insights, translations,
translation_entries, agent conversations), search_documents, serverless
storage + logs.

Behaviors that may need follow-up:

- Polymorphic refs (`comments.refType`, `drafts.refType`,
  `slug_trackers.targetId`, `ai_*.refId`) probe candidate collections
  in id-map order and emit a missing-ref warning if no match; tighten
  per-step lookup if the source data is known to be cleaner.
- `serverless_logs.functionId` is currently set to null because the
  legacy schema stores a string identifier. If a snippet→function mapping
  exists in production data, add a step before serverless to populate it.
- The migration tool does not yet checksum row counts cross-database; if
  you want stronger guarantees, extend `runner.ts` to compare
  `mongo.collection.countDocuments()` to `pg.select(count()).from(table)`.

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
