# MongoDB to PostgreSQL Production Migration Guide

This document is the production runbook for the one-time MX Space Core cutover
from MongoDB to PostgreSQL.

The migration is a hard cutover. There is no dual-write window. MongoDB is the
authoritative source before the maintenance window; PostgreSQL becomes the
authoritative runtime database only after the migration, validation, and traffic
switch are complete.

## Scope

| Area | Decision |
| --- | --- |
| Source database | MongoDB, read-only during the migration window. |
| Target database | PostgreSQL 16+. |
| Schema migration | Drizzle SQL migrations under `apps/core/src/database/migrations`. |
| Data migration | `apps/core/scripts/migrate-mongo-to-postgres.ts`. |
| Canonical IDs | PostgreSQL `bigint` Snowflake IDs, serialized as strings at API boundaries. |
| Mongo `_id` retention | Stored only in migration support tables such as `mongo_id_map`. |
| Runtime rollback | Return to the pre-cutover MongoDB snapshot and previous application version. |

## Cutover Flow

```text
┌────────────────────┐
│ Freeze writes      │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Back up MongoDB    │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Prepare PostgreSQL │
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ Dry-run migration  │
└─────────┬──────────┘
          ▼
    ◆ Report clean? ◆
       │         │
       │ no      │ yes
       ▼         ▼
┌────────────┐  ┌─────────────────┐
│ Fix source │  │ Apply migration │
└────────────┘  └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Smoke validation│
                └────────┬────────┘
                         ▼
                   ◆ Accept? ◆
                   │       │
                   │ no    │ yes
                   ▼       ▼
            ┌──────────┐ ┌───────────────┐
            │ Rollback │ │ Switch traffic│
            └──────────┘ └───────────────┘
```

## Preconditions

| Requirement | Production Rule |
| --- | --- |
| Maintenance window | Stop public and admin writes before the final backup. |
| Application version | Deploy a build that contains the PostgreSQL schema, repositories, and migration CLI. |
| Node.js | Use the version required by `apps/core/package.json`; currently Node.js 22+. |
| PostgreSQL | Use PostgreSQL 16+ and a database created for MX Space Core. |
| MongoDB source | Use a connection string that includes the correct production database name. |
| Redis and object storage | Keep unchanged; this migration does not move Redis or file storage data. |
| Snowflake worker IDs | Allocate unique runtime IDs before starting clustered production. |

## Environment Variables

### Migration CLI

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | Yes | Source MongoDB URI. Include the database name, for example `mongodb://host:27017/mx-space`. |
| `PG_URL` or `PG_CONNECTION_STRING` | Yes | Target PostgreSQL URI. Prefer a single URL for production execution. |
| `SNOWFLAKE_WORKER_ID` | Yes | Worker ID used by migration-generated rows. Reserve `900-999`; use `900` unless already allocated. |

The CLI also accepts `DB_CONNECTION_STRING` as a MongoDB fallback and `PG_HOST`,
`PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` as PostgreSQL fallbacks. For
production, explicit `MONGO_URI` and `PG_URL` are less ambiguous.

If the PostgreSQL provider requires SSL during migration, encode the required
connection parameters in `PG_URL`; the migration CLI does not read the runtime
`PG_SSL` flag.

### Runtime Application

| Variable | Required | Notes |
| --- | --- | --- |
| `PG_URL` or `PG_CONNECTION_STRING` | Recommended | Overrides individual PostgreSQL host/user/password/database variables. |
| `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` | Conditional | Used when no PostgreSQL connection string is supplied. |
| `PG_MAX_POOL_SIZE` | Optional | Defaults to `20`. Size according to PostgreSQL capacity and cluster process count. |
| `PG_SSL` | Optional | Set to `true` when the runtime PostgreSQL connection requires SSL. |
| `MIGRATIONS_DIR` | Optional | Runtime override for Drizzle migration files. Usually not needed. |
| `SNOWFLAKE_WORKER_ID` | Yes outside development | Runtime base worker ID. |
| `SNOWFLAKE_WORKER_OFFSET` | Automatic for app cluster | Set by the built-in cluster launcher. Normally do not set manually. |
| `NODE_APP_INSTANCE` | Automatic for PM2 cluster | Used as the runtime worker offset when `SNOWFLAKE_WORKER_OFFSET` is absent. |

Effective runtime worker ID is:

```text
SNOWFLAKE_WORKER_ID + process offset
```

The effective value must be within `0..1023`. For an 8-process cluster with
`SNOWFLAKE_WORKER_ID=10`, the effective worker IDs are `10..17`. Do not allocate
overlapping ranges across independent deployments, blue-green environments, or
background workers that may write to the same PostgreSQL database.

## Backup Requirements

### 1. MongoDB Backup

Run the final backup after writes are frozen:

```bash
mongodump \
  --uri="$MONGO_URI" \
  --archive="./backup-mongo-$(date +%Y%m%d%H%M%S).archive" \
  --gzip
```

Record:

| Item | Required Evidence |
| --- | --- |
| Backup file path | Absolute path or object-storage URL. |
| Backup size | Non-zero size and expected order of magnitude. |
| MongoDB database name | The database embedded in `MONGO_URI`. |
| Backup timestamp | UTC timestamp after the write freeze began. |
| Restore test | Restore into an isolated MongoDB instance when time allows. |

### 2. PostgreSQL Pre-Migration Snapshot

If reusing a non-empty PostgreSQL database, take a `pg_dump` before migration:

```bash
pg_dump "$PG_URL" \
  --format=custom \
  --file="./backup-pg-before-migration-$(date +%Y%m%d%H%M%S).dump"
```

For a new empty database, record database creation time and PostgreSQL version
instead.

## Preflight Checks

### 1. Confirm Tooling

Run from the repository root:

```bash
pnpm -C apps/core exec tsx --version
pnpm -C apps/core exec tsc -p tsconfig.json --noEmit
```

### 2. Confirm PostgreSQL Connectivity

```bash
psql "$PG_URL" -c 'select version();'
psql "$PG_URL" -c 'select current_database(), current_user;'
```

### 3. Confirm MongoDB Connectivity

```bash
mongosh "$MONGO_URI" --eval 'db.runCommand({ ping: 1 })'
mongosh "$MONGO_URI" --eval 'db.getCollectionNames().sort()'
```

### 4. Confirm Runtime Worker ID Allocation

For every production process group, compute:

| Deployment | Base ID | Process Count | Effective Range |
| --- | ---: | ---: | --- |
| Primary web/API cluster | `10` | `N` | `10..(10 + N - 1)` |
| One-off migration CLI | `900` | `1` | `900` |
| Any additional writer | Document explicitly | Document explicitly | No overlap allowed |

The migration CLI should not run concurrently with a live PostgreSQL writer.
The write freeze is still required even when Snowflake ranges are distinct.

## Dry-Run Migration

Run dry-run before the maintenance window against a recent production clone.
Run it again during the final window after the final MongoDB backup.

Important: use `pnpm -C apps/core`. The CLI resolves Drizzle migration files
relative to the `apps/core` working directory.

```bash
SNOWFLAKE_WORKER_ID=900 \
MONGO_URI="$MONGO_URI" \
PG_URL="$PG_URL" \
pnpm -C apps/core exec tsx scripts/migrate-mongo-to-postgres.ts --mode dry-run
```

Dry-run behavior:

| Phase | Behavior |
| --- | --- |
| Mongo read | Reads all source collections used by the migration steps. |
| ID allocation | Allocates Snowflake IDs in memory. |
| Reference resolution | Resolves cross-collection references against the in-memory ID map. |
| PostgreSQL writes | None. Schema migrations are not applied in dry-run mode. |
| Report | Prints row allocation counts, loaded-row simulation counts, missing references, and warnings. |

Dry-run acceptance criteria:

| Report Section | Required Outcome |
| --- | --- |
| `Rows allocated` | Counts are plausible compared with MongoDB collection counts. |
| `Rows loaded` | Counts are plausible and no critical collection is unexpectedly zero. |
| `Missing refs` | `0` for production cutover unless every missing reference is explicitly accepted. |
| `Warnings` | Reviewed. Invalid optional metadata may be acceptable; auth/content warnings require investigation. |

## Apply Migration

Only run apply mode after:

- Writes are frozen.
- Final MongoDB backup is complete.
- Dry-run has been reviewed.
- PostgreSQL target is the intended production database.
- The application is not yet serving PostgreSQL production traffic.

```bash
SNOWFLAKE_WORKER_ID=900 \
MONGO_URI="$MONGO_URI" \
PG_URL="$PG_URL" \
pnpm -C apps/core exec tsx scripts/migrate-mongo-to-postgres.ts --mode apply
```

Apply mode behavior:

| Phase | Behavior |
| --- | --- |
| Schema | Applies Drizzle migrations from `apps/core/src/database/migrations`. |
| Existing ID map | Loads existing `mongo_id_map` rows to support reruns. |
| Allocation | Allocates Snowflake IDs for source documents not already mapped. |
| ID map persistence | Persists `mongo_id_map` before loading dependent rows. |
| Data load | Loads PostgreSQL tables in dependency order with `onConflictDoNothing`. |
| Audit row | Writes a row into `data_migration_runs`. |

The migration is resumable at table and ID-map boundaries, but it is not a
substitute for a clean rehearsal. If apply mode fails, capture the error,
inspect the partially loaded PostgreSQL database, and decide whether to drop
and recreate the target database or continue from the persisted ID map.

## Migrated Data Domains

| Domain | Collections / Tables |
| --- | --- |
| Content taxonomy | `categories`, `topics` |
| Content | `posts`, `notes`, `pages`, `recentlies`, `comments`, `drafts` |
| Authentication | `readers`, `owner_profiles`, `accounts`, `sessions`, `api_keys`, `passkeys`, `verifications` |
| Configuration | `options` |
| Public resources | `links`, `projects`, `says`, `snippets`, `subscribes` |
| Analytics and activity | `activities`, `analyzes` |
| Files | `file_references` |
| Polls | `poll_votes`, `poll_vote_options` |
| Slugs and webhooks | `slug_trackers`, `webhooks`, `webhook_events` |
| AI data | `ai_summaries`, `ai_insights`, `ai_translations`, `translation_entries`, `ai_agent_conversations` |
| Search | `search_documents` |
| Serverless | `serverless_storages`, `serverless_logs` |

Execution order:

| Order | Step |
| ---: | --- |
| 1 | `categories` |
| 2 | `topics` |
| 3 | `readers` |
| 4 | `owner_profiles` |
| 5 | `accounts` |
| 6 | `sessions` |
| 7 | `api_keys` |
| 8 | `passkeys` |
| 9 | `verifications` |
| 10 | `posts` |
| 11 | `notes` |
| 12 | `pages` |
| 13 | `recentlies` |
| 14 | `comments` |
| 15 | `drafts` |
| 16 | `options`, `links`, `projects`, `says`, `snippets`, `subscribes`, `activities`, `analyzes` |
| 17 | `file_references` |
| 18 | `poll_votes`, `poll_vote_options` |
| 19 | `slug_trackers` |
| 20 | `webhooks`, `webhook_events` |
| 21 | `ai_summaries`, `ai_insights`, `ai_translations`, `translation_entries`, `ai_agent_conversations` |
| 22 | `search_documents` |
| 23 | `serverless_storages`, `serverless_logs` |

## Post-Apply Database Verification

Run these checks before starting production traffic.

```bash
psql "$PG_URL" -c 'select status, started_at, finished_at, error from data_migration_runs order by started_at desc limit 5;'
psql "$PG_URL" -c 'select count(*) from mongo_id_map;'
psql "$PG_URL" -c 'select count(*) from posts;'
psql "$PG_URL" -c 'select count(*) from notes;'
psql "$PG_URL" -c 'select count(*) from comments;'
psql "$PG_URL" -c 'select count(*) from readers;'
```

Compare representative counts with MongoDB:

```bash
mongosh "$MONGO_URI" --quiet --eval '
for (const name of ["posts", "notes", "pages", "comments", "readers"]) {
  print(`${name} ${db.getCollection(name).countDocuments()}`)
}
'
```

Expected differences must be explained by documented filtering rules, such as
rows skipped because required references were missing.

## Runtime Smoke Test

Start the application against PostgreSQL with a runtime worker ID range that is
not the migration range.

```bash
PG_URL="$PG_URL" \
SNOWFLAKE_WORKER_ID=10 \
pnpm -C apps/core run dev
```

For production process managers, set equivalent environment variables in the
service definition. If using cluster mode, ensure:

```text
SNOWFLAKE_WORKER_ID + process_count - 1 <= 1023
```

Smoke endpoints:

```bash
curl -fsS "$SERVER_URL/aggregate" >/tmp/mx-aggregate.json
curl -fsS "$SERVER_URL/posts" >/tmp/mx-posts.json
curl -fsS "$SERVER_URL/notes" >/tmp/mx-notes.json
curl -fsS "$SERVER_URL/comments" >/tmp/mx-comments.json
```

Admin smoke checks:

| Area | Operation |
| --- | --- |
| Authentication | Log in with the owner account. |
| API key | Call an authenticated endpoint with `x-api-key`. |
| Content read | Open representative post, note, page, comment thread, and recently feed. |
| Content write | In staging, create and delete a draft or private test note. |
| Metadata | Verify post/note/page `meta` fields that previously contained JSON strings. |
| AI data | Open a migrated item with summary, translation, or insight metadata if production uses AI features. |
| Files | Open content with cover images or file references. |

## Traffic Switch

Proceed only when:

- Apply mode completed.
- `data_migration_runs` contains the latest run.
- Missing references and warnings have been reviewed.
- Public read smoke tests pass.
- Admin authentication smoke tests pass.
- A rollback owner is present and available during the confidence window.

Switch the production service to the PostgreSQL-enabled build and runtime
environment. Keep MongoDB online but read-only until the confidence window ends.

## Rollback Strategy

Because there is no dual-write window, rollback depends on whether PostgreSQL
has accepted new production writes.

| Failure Point | Rollback Procedure |
| --- | --- |
| Dry-run fails | Keep production on MongoDB. Fix source data or migration code and rerun dry-run. |
| Apply fails before traffic switch | Keep production on MongoDB. Drop or archive the PostgreSQL target, fix the cause, and rerun from the MongoDB backup. |
| Smoke test fails before traffic switch | Keep production on MongoDB. Preserve PostgreSQL for investigation. |
| Failure after traffic switch, before accepted writes | Stop the new app, restore previous MongoDB-backed version and configuration, and keep the frozen MongoDB snapshot authoritative. |
| Failure after PostgreSQL accepted writes | Prefer forward-fix. If rollback is mandatory, manually reconcile PostgreSQL-only writes before restoring MongoDB-backed production. |

Rollback commands are environment-specific, but the minimum database procedure
for a full target reset is:

```bash
dropdb "$PG_DATABASE"
createdb "$PG_DATABASE"
```

Use the equivalent managed-database workflow for hosted PostgreSQL. Do not drop
or overwrite MongoDB unless the rollback owner explicitly approves it.

## Troubleshooting

| Symptom | Likely Cause | Action |
| --- | --- | --- |
| `unknown mode` | Incorrect `--mode` value. | Use `--mode dry-run` or `--mode apply`. |
| Drizzle migrations folder not found | CLI was run from the repository root without `pnpm -C apps/core`. | Rerun with `pnpm -C apps/core exec tsx scripts/migrate-mongo-to-postgres.ts`. |
| `Missing refs` in report | Source data references a missing Mongo document. | Inspect the listed collection, field, and Mongo ID; repair source data or explicitly accept the skipped relation. |
| Duplicate primary keys | Snowflake worker ID collision or reused target database with conflicting rows. | Stop writers, verify worker ranges, inspect `mongo_id_map`, and reset target if necessary. |
| `meta contains invalid JSON string` warning | Legacy content metadata is malformed. | Inspect the source document. Optional malformed `meta` is migrated as `null`. |
| Runtime refuses to start with worker ID error | Effective worker ID exceeds `1023` or offset is invalid. | Reduce process count or choose a lower `SNOWFLAKE_WORKER_ID`. |
| Login fails after migration | Auth tables or owner profile did not migrate as expected. | Check `readers`, `accounts`, `sessions`, `api_keys`, and `owner_profiles`; do not switch traffic until resolved. |

## Final Sign-Off Checklist

| Check | Owner | Status |
| --- | --- | --- |
| Write freeze announced and active | Operations |  |
| MongoDB final backup completed | Operations |  |
| PostgreSQL target confirmed | Operations |  |
| Runtime Snowflake worker ranges documented | Operations |  |
| Dry-run report reviewed | Engineering |  |
| Apply mode completed | Engineering |  |
| `data_migration_runs` row verified | Engineering |  |
| Public read smoke tests passed | Engineering |  |
| Admin authentication smoke tests passed | Engineering |  |
| Rollback decision owner available | Operations |  |
| Traffic switched | Operations |  |
| MongoDB retained read-only for confidence window | Operations |  |
