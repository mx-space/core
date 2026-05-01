# PostgreSQL + Snowflake Database Migration - Design Spec

Date: 2026-05-02
Status: Draft
Author: Codex

## 1. Overview

MX Space Core currently persists application data through MongoDB, Mongoose, and Typegoose. The migration target is PostgreSQL with a type-safe repository layer and Snowflake IDs as the canonical identity model.

The migration is a hard database cutover. MongoDB remains only as the source for the one-time migration tool and as historical backup input. After cutover, application runtime code must not depend on MongoDB, Mongoose, Typegoose, Mongo ObjectId, `mongodump`, or `mongorestore`.

## 2. Motivation

| Problem | Current Cause | Target Outcome |
|---|---|---|
| Weak type guarantees | MongoDB document shape is flexible and Mongoose typing is not authoritative enough at business boundaries. | PostgreSQL schema and repository DTOs become the source of truth. |
| Difficult structural migration | Historical Mongo migrations mutate loosely typed documents and require defensive runtime checks. | Schema changes are explicit SQL migrations with typed data transforms. |
| Mixed ID semantics | Business code still handles `_id`, `id`, ObjectId instances, and 24-hex strings. | A single canonical `id` contract is used: Snowflake decimal string externally, PostgreSQL `bigint` internally. |
| Implicit data loading | `populate`, `autopopulate`, `lean`, and plugin transforms hide query behavior. | All joins and projections are explicit repository methods. |
| Tooling lock-in | Auth, backup, migrations, tests, and init checks are Mongo-specific. | Runtime operations use PostgreSQL-native tools and test fixtures. |

## 3. Goals and Non-goals

### Goals

- Replace MongoDB runtime storage with PostgreSQL.
- Replace Mongoose/Typegoose model access with explicit repository classes.
- Replace ObjectId with Snowflake IDs for all first-class application entities.
- Preserve public API shape where practical: response IDs remain strings.
- Provide a deterministic one-time MongoDB-to-PostgreSQL migration path.
- Keep Redis, object storage, AI runtime, and HTTP API semantics outside the migration unless directly database-coupled.
- Use behavior-oriented regression tests for externally meaningful behavior.

### Non-goals

- No MongoDB/PostgreSQL dual-write compatibility window in the first implementation.
- No attempt to preserve Mongo `_id` as a public or domain identifier.
- No broad API redesign beyond ID validation and database-coupled response normalization.
- No implementation-snapshot tests that merely freeze schema object literals or repository method inventories.
- No full-text-search product redesign in the first cutover; retain the existing `search_documents` concept first.

## 4. Current State Inventory

| Area | Current File(s) | Migration Implication |
|---|---|---|
| Connection | `apps/core/src/utils/database.util.ts` | Replace `getDatabaseConnection()` with PostgreSQL pool/client initialization. |
| Provider registry | `apps/core/src/processors/database/database.models.ts` | Replace Typegoose provider list with repository providers. |
| Model transformer | `apps/core/src/transformers/model.transformer.ts` | Remove `InjectModel` and `getModelForClass`; introduce repository injection tokens. |
| Base model | `apps/core/src/shared/model/base.model.ts` | Replace Mongoose plugin semantics with explicit `created` and ID mapping. |
| DTO validation | `apps/core/src/common/zod/primitives.ts`, `apps/core/src/shared/dto/id.dto.ts` | Replace `zMongoId`/`MongoIdDto` with Snowflake entity ID validators. |
| Auth | `apps/core/src/modules/auth/auth.implement.ts`, `apps/core/src/modules/auth/auth.service.ts` | Replace Better Auth Mongo adapter and raw Mongo collection access. |
| Migration runner | `apps/core/src/migration/migrate.ts` | Replace Mongo migration history and lock collection with SQL migration table and advisory lock. |
| Backup/restore | `apps/core/src/modules/backup/backup.service.ts` | Replace `mongodump`/`mongorestore` with `pg_dump`/`pg_restore` or SQL archive flow. |
| Tests | `apps/core/test/helper/db-mock.helper.ts`, `apps/core/vitest.config.mts` | Replace `mongodb-memory-server` with PostgreSQL test service or testcontainers. |

## 5. Architecture

```mermaid
flowchart LR
  subgraph Source
    Mongo[(MongoDB)]
  end

  subgraph Migration
    Extractor[Mongo Extractor]
    IdMap[(mongo_id_map)]
    Loader[PostgreSQL Loader]
  end

  subgraph Runtime
    PG[(PostgreSQL)]
    Repos[Typed Repositories]
    Services[Nest Services]
    API[Controllers and API Client]
  end

  Mongo --> Extractor
  Extractor --> IdMap
  IdMap --> Loader
  Loader --> PG
  PG --> Repos
  Repos --> Services
  Services --> API
```

### Target Runtime Boundaries

| Boundary | Rule |
|---|---|
| Database | PostgreSQL stores IDs as `bigint`. |
| Repository | Repositories convert Snowflake `bigint` to string before returning domain objects. |
| Service | Services consume `EntityId` strings and never construct SQL fragments directly. |
| Controller | Controllers validate decimal Snowflake strings with `zEntityId`. |
| API client | Generated or handwritten models continue to expose `id: string`. |
| Migration | Mongo ObjectIds are accepted only in migration input and `mongo_id_map`. |

## 6. Technology Selection

| Component | Decision | Rationale |
|---|---|---|
| Database | PostgreSQL 16+ | Mature relational constraints, `jsonb`, generated indexes, advisory locks, `pg_dump`. |
| Query layer | Drizzle ORM + `pg` | TypeScript-first SQL modeling without hiding SQL semantics behind document-like APIs. |
| Migrations | Drizzle SQL migrations plus custom data migrations | Schema migrations and data transformations have different failure modes and should be separated. |
| IDs | Snowflake `bigint`, serialized as string | Time-sortable, compact, non-ObjectId, globally generatable across clustered workers. |
| Tests | PostgreSQL test database | Database behavior must be validated against real SQL semantics. |

If Better Auth adapter support changes during implementation, the implementation phase must verify the exact supported PostgreSQL/Drizzle adapter. If a suitable adapter is unavailable, implement the Better Auth adapter contract against the same PostgreSQL pool rather than retaining MongoDB.

## 7. Snowflake Identity Model

### Canonical Contract

| Layer | Representation | Constraint |
|---|---|---|
| PostgreSQL primary key | `bigint` | Positive signed 64-bit integer. |
| PostgreSQL foreign key | `bigint` | References first-class table IDs where practical. |
| Polymorphic reference | `ref_type text`, `ref_id bigint` | Validated by repository/service logic. |
| TypeScript domain | `EntityId` branded string | Decimal string only; never JavaScript `number`. |
| JSON/API | string | Avoid precision loss beyond `Number.MAX_SAFE_INTEGER`. |

### Bit Layout

| Bits | Field | Notes |
|---:|---|---|
| 41 | Timestamp milliseconds | Offset from custom epoch. |
| 10 | Worker ID | Supports 1024 generator nodes. |
| 12 | Sequence | Supports 4096 IDs per millisecond per worker. |

Use a custom epoch such as `2026-05-02T00:00:00.000Z`. Keep the sign bit unused so every generated ID remains positive inside PostgreSQL `bigint`.

### Generator Rules

- `SnowflakeService.nextId()` returns `EntityId`.
- Internal arithmetic uses `bigint`.
- The service must reject unsafe numeric input at boundaries.
- Clustered production must provide a stable worker ID through configuration.
- Worker ID collisions are fatal; the process must fail fast.
- If the clock moves backwards, the generator must either wait until the last timestamp or throw a fatal startup/runtime error according to a documented policy.
- IDs generated during migration can use a dedicated migration worker ID range, for example `900-999`, to separate migration-generated rows from runtime rows.

### Proposed Files

| File | Responsibility |
|---|---|
| `apps/core/src/shared/id/entity-id.ts` | `EntityId` type, parser, serializer, zod validator. |
| `apps/core/src/shared/id/snowflake.service.ts` | Snowflake generator implementation. |
| `apps/core/src/shared/id/snowflake.spec.ts` | Monotonicity, uniqueness, serialization, and clock rollback behavior. |
| `apps/core/src/app.config.ts` | `SNOWFLAKE_WORKER_ID` and epoch configuration. |

## 8. PostgreSQL Schema Strategy

### Common Columns

Most first-class tables should share this baseline shape:

```sql
id bigint primary key,
created_at timestamptz not null default now()
```

Tables with update semantics add:

```sql
updated_at timestamptz
```

JSON-like application data should use `jsonb`, not stringified JSON.

### Collection-to-Table Mapping

| Mongo Collection | PostgreSQL Table | Notes |
|---|---|---|
| `categories` | `categories` | Preserve `type`, `name`, `slug`; unique indexes on `name` and `slug`. |
| `topics` | `topics` | Preserve `name`, `slug`, `description`, `introduce`, `icon` unless separately renamed. |
| `posts` | `posts` | `category_id bigint`; `tags text[]`; `meta jsonb`; `count` can be columns or embedded JSON depending on query needs. |
| `notes` | `notes` | Preserve `nid integer unique`; `topic_id bigint`; `coordinates jsonb` or typed columns. |
| `pages` | `pages` | Preserve slug/order/subtitle/content fields. |
| `comments` | `comments` | `ref_type text`, `ref_id bigint`, `parent_comment_id bigint`, `root_comment_id bigint`. |
| `drafts` | `drafts` | `ref_type text`, `ref_id bigint`; `history jsonb` or child table after query review. |
| `readers` | `readers` | Better Auth user table semantics must be aligned before final schema. |
| `owner_profiles` | `owner_profiles` | `reader_id bigint unique`; `social_ids jsonb`. |
| `accounts` | `accounts` | Better Auth account table; confirm adapter-required column names. |
| `sessions` | `sessions` | Better Auth session table; preserve provider extension. |
| `apikey` | `api_keys` or adapter table | Preserve legacy API key behavior and migration compatibility. |
| `ai_translations` | `ai_translations` | `ref_id bigint`; unique `(ref_id, ref_type, lang)`. |
| `translation_entries` | `translation_entries` | Unique `(key_path, lang, key_type, lookup_key)`. |
| `ai_summaries` | `ai_summaries` | `ref_id bigint`; index by `ref_id`. |
| `ai_insights` | `ai_insights` | `ref_id bigint`; unique `(ref_id, lang)`. |
| `search_documents` | `search_documents` | Preserve denormalized search cache first; future `tsvector` is separate. |
| `file_references` | `file_references` | `ref_id bigint`; status/ref indexes. |
| `activities` | `activities` | `payload jsonb`; consider generated columns only after query profiling. |
| `analyzes` | `analyzes` | `ua jsonb`; time-series indexes by `timestamp`. |
| `recentlies` | `recentlies` | `metadata jsonb`; polymorphic reference retained. |
| `serverless_storages` | `serverless_storages` | `value jsonb`; unique `(namespace, key)`. |
| `serverless_logs` | `serverless_logs` | `logs jsonb`, `error jsonb`; TTL becomes scheduled cleanup. |
| `webhooks` | `webhooks` | Secret columns remain non-selected at repository boundary. |
| `webhook_events` | `webhook_events` | `headers jsonb`, `payload jsonb`, `response jsonb/text`. |

### Migration Metadata Tables

```sql
create table schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table mongo_id_map (
  collection text not null,
  mongo_id text not null,
  snowflake_id bigint not null,
  primary key (collection, mongo_id),
  unique (snowflake_id)
);

create table data_migration_runs (
  id bigint primary key,
  name text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  error text
);
```

## 9. Repository Layer

### Repository Principles

- A repository method returns domain objects with `id: EntityId`, not database rows.
- Repository inputs accept `EntityId`, not `bigint`.
- SQL joins replace `populate` and `autopopulate`.
- Pagination returns the existing public pagination shape.
- Repository methods are named by behavior, not by Mongo equivalents.

### Initial Repository Files

| File | Responsibility |
|---|---|
| `apps/core/src/processors/database/postgres.provider.ts` | PostgreSQL pool and Drizzle database provider. |
| `apps/core/src/processors/database/repository.tokens.ts` | Injection tokens for repositories. |
| `apps/core/src/modules/post/post.repository.ts` | Post CRUD, slug lookup, category join, related posts. |
| `apps/core/src/modules/note/note.repository.ts` | Note CRUD, `nid` lookup, topic join, visibility filters. |
| `apps/core/src/modules/page/page.repository.ts` | Page CRUD and ordering. |
| `apps/core/src/modules/comment/comment.repository.ts` | Comment threads, reply counts, anchor operations. |
| `apps/core/src/modules/auth/auth.repository.ts` | Reader, account, owner profile, API key queries. |
| `apps/core/src/modules/search/search.repository.ts` | Search document indexing and lookup. |

## 10. Query Rewrite Rules

| Mongo/Mongoose Pattern | PostgreSQL Replacement |
|---|---|
| `findById(id)` | `where(eq(table.id, parseEntityId(id)))`. |
| `populate('category')` | Explicit join against `categories`. |
| `autopopulate` | Explicit repository projection method. |
| `lean({ getters: true })` | Repository row mapper. |
| `paginate()` | `limit/offset` or cursor query plus explicit count. |
| `aggregatePaginate()` | CTE plus `count(*) over()` or separate count query. |
| `$lookup` | SQL join. |
| `$group` | SQL `group by`. |
| `$dateToString` | `to_char()` or `date_trunc()` depending on grouping semantics. |
| `$exists: false` | Nullable column condition or JSONB key absence. |
| stringified JSON getter | `jsonb` column mapper. |

### Cursor Policy

ObjectId-order cursor behavior must not be translated blindly. Use:

- `(created_at, id)` cursor for chronological feeds.
- `id` cursor only where insertion order is the intended ordering.
- Offset pagination for admin tables where deterministic sorting is explicit.

## 11. Data Migration Plan

### High-level Flow

```mermaid
flowchart TD
  A[Freeze writes] --> B[Create PostgreSQL schema]
  B --> C[Generate mongo_id_map]
  C --> D[Migrate independent tables]
  D --> E[Migrate dependent content tables]
  E --> F[Rewrite references]
  F --> G[Validate counts and checksums]
  G --> H[Run application smoke tests]
  H --> I[Switch runtime to PostgreSQL]
```

### Migration Ordering

| Order | Data | Reason |
|---:|---|---|
| 1 | `mongo_id_map` for every first-class document | All references need deterministic target IDs. |
| 2 | Config-like tables: options/configs/meta presets | Low dependency surface. |
| 3 | Taxonomy: categories, topics | Required by posts and notes. |
| 4 | Identity: readers, owner profiles, accounts, sessions, API keys | Required by auth and ownership checks. |
| 5 | Content: posts, notes, pages, recentlies | Core public data. |
| 6 | Dependent content: comments, drafts, file references, search documents | References content rows. |
| 7 | AI data: summaries, insights, translations, translation entries | References content and translation key paths. |
| 8 | Operational data: activities, analyzes, serverless storage/logs, webhooks/events | Lower-risk runtime-adjacent data. |
| 9 | Migration history and backup metadata | Final bookkeeping. |

### Data Conversion Rules

| Source Shape | Target Shape |
|---|---|
| Mongo `_id` | `mongo_id_map.mongo_id`; new row `id = snowflake_id`. |
| ObjectId reference | Lookup in `mongo_id_map`; fail migration if missing unless field is explicitly nullable. |
| 24-hex string that represents a ref | Lookup in `mongo_id_map` according to known collection context. |
| Arbitrary user string that looks like ObjectId | Keep as string; do not apply heuristic rewriting in `jsonb`. |
| Stringified `meta` | Parse into `jsonb`; keep raw string only if parse fails and field semantics require it. |
| Mongoose enum number | Preserve numeric enum unless public API already expects string. |
| Mongoose `created` | `created_at`. |
| Better Auth `createdAt`/`updatedAt` | Preserve adapter-required column names or map through adapter configuration. |

### Migration Failure Policy

- Missing required reference: fail the migration.
- Duplicate unique key: fail unless a documented deduplication rule exists.
- Invalid JSON in optional metadata: log and store as fallback string field only if the schema provides one.
- Invalid ObjectId in historical optional ref: set null only when the original field is optional.
- Count mismatch: fail.

## 12. Auth Migration

Auth requires a separate implementation checkpoint because Better Auth owns table shape assumptions.

| Step | Requirement |
|---|---|
| Adapter validation | Confirm current Better Auth version supports the chosen PostgreSQL/Drizzle adapter. |
| Schema alignment | Generate or handwrite required `users`, `accounts`, `sessions`, `apikey`, and passkey tables. |
| Legacy password support | Preserve bcrypt-to-Better-Auth-hash upgrade behavior. |
| API key compatibility | Preserve custom `txo` token handling and legacy `referenceId` fallback during migration. |
| Owner profile | Keep owner profile as MX Space table linked by Snowflake `reader_id`. |

The auth migration must include focused tests for sign-in, API key verification, owner lookup, token creation, token deletion, and legacy token migration.

## 13. Backup and Restore

| Existing Behavior | Target Behavior |
|---|---|
| `mongodump` database archive | `pg_dump` custom-format archive or SQL archive. |
| `mongorestore --drop` | `pg_restore --clean --if-exists` or controlled schema recreation. |
| Exclude Mongo collections | Exclude SQL tables or data classes by explicit table list. |
| Run Mongo migrations after restore | Run SQL schema migrations and PostgreSQL data repair checks. |

Restore must not use destructive shell operations against application data directories without the same explicit safety checks already present in the current backup service.

## 14. Testing Strategy

### Required Test Categories

| Category | Tests |
|---|---|
| ID generation | Snowflake monotonicity, serialization, worker collision configuration, clock rollback behavior. |
| Repository mapping | `bigint` row IDs serialize as strings; invalid numeric IDs are rejected. |
| Content behavior | Post list, post detail, note list, note detail, page detail, comments, drafts. |
| Aggregation behavior | Counts, category distribution, tag cloud, publication trend, top articles. |
| Auth behavior | Owner bootstrap, sign-in, session, API key lifecycle, owner profile patch. |
| Migration behavior | ObjectId references rewrite correctly; missing required refs fail; count and checksum verification. |
| Backup behavior | PostgreSQL archive creation and restore smoke path. |

### Verification Commands

```bash
pnpm -C apps/core exec vitest run test/src/shared/id
pnpm -C apps/core exec vitest run test/src/modules/post test/src/modules/note test/src/modules/comment
pnpm -C apps/core exec vitest run test/src/modules/auth
pnpm -C apps/core exec vitest run test/src/migration
pnpm -C apps/core exec tsc -p tsconfig.json --noEmit
pnpm -C apps/core run bundle
```

The exact test paths may change during implementation, but each behavior class above must remain covered.

## 15. Implementation Phases

### Phase 0: Finalize Decisions

- Choose PostgreSQL version and local development container image.
- Choose Drizzle migration directory layout.
- Confirm Better Auth adapter strategy.
- Define Snowflake epoch and worker ID allocation policy.
- Decide whether `count.read` and `count.like` become physical columns or a JSONB object.

### Phase 1: Add PostgreSQL Infrastructure

- Add `pg`, `drizzle-orm`, and migration tooling.
- Add PostgreSQL configuration to `app.config.ts` and test config.
- Create PostgreSQL provider and health check.
- Add Snowflake ID service and tests.
- Add `zEntityId`, `EntityIdDto`, and compatibility naming deprecations.

### Phase 2: Build Schema and Repositories

- Create schema files for core tables.
- Implement repositories for categories, topics, posts, notes, pages, comments, and readers.
- Keep service APIs stable while replacing model calls internally.
- Port aggregation-heavy queries into SQL one module at a time.

### Phase 3: Auth Cutover

- Replace Mongo Better Auth adapter.
- Port raw collection access in `auth.service.ts`, `owner.service.ts`, `reader.service.ts`, and `serverless.service.ts`.
- Preserve existing login and API key behavior through behavioral tests.

### Phase 4: Data Migration Tool

- Build a dry-run-capable migration CLI.
- Generate `mongo_id_map` before loading dependent rows.
- Load tables in dependency order.
- Emit count, reference, and checksum reports.
- Support resumable runs only at phase boundaries, not mid-table mutation.

### Phase 5: Runtime Cutover

- Replace remaining `InjectModel` and `databaseService.db` usage.
- Remove Mongoose plugins and Typegoose model registration.
- Update backup/restore, init checks, Docker compose, README, and deployment docs.
- Run full verification against a staging copy.

### Phase 6: Cleanup

- Remove MongoDB dependencies from `apps/core/package.json` and root dev dependencies.
- Remove Mongo-specific migrations from runtime execution path; keep historical files only if needed for migration source documentation.
- Remove `zMongoId` from public DTO usage.
- Remove `mongodb-memory-server` test setup.

## 16. Cutover Runbook

| Step | Action |
|---:|---|
| 1 | Announce write freeze window. |
| 2 | Take MongoDB backup using current backup service. |
| 3 | Provision PostgreSQL and apply schema migrations. |
| 4 | Run migration CLI in dry-run mode. |
| 5 | Review row counts, missing refs, duplicate keys, and checksum report. |
| 6 | Run migration CLI in apply mode. |
| 7 | Start application with PostgreSQL configuration in staging mode. |
| 8 | Run smoke tests for public API, admin writes, auth, AI metadata, and comments. |
| 9 | Switch production runtime configuration to PostgreSQL. |
| 10 | Keep MongoDB read-only backup until post-cutover confidence window ends. |

## 17. Rollback Strategy

Because the first implementation does not include dual-write, rollback means returning to the frozen MongoDB snapshot and previous application version.

| Scenario | Rollback |
|---|---|
| Migration fails before cutover | Drop PostgreSQL staging schema, fix migration, rerun from Mongo source. |
| Smoke tests fail before traffic switch | Keep production on MongoDB; fix repository or migration issue. |
| Failure after traffic switch with no accepted writes | Revert application config/version to MongoDB and restore from pre-cutover backup if needed. |
| Failure after PostgreSQL accepts writes | Manual decision required; either forward-fix PostgreSQL or write a reverse migration for accepted writes. |

To reduce rollback ambiguity, the cutover should keep a short read-only validation window before enabling admin writes.

## 18. Open Questions

| Question | Default |
|---|---|
| Should Snowflake worker ID come from config, machine ID, or deployment slot? | Config first; fail if ambiguous. |
| Should `count` fields be columns or JSONB? | Columns for `read` and `like`, because aggregation reads them frequently. |
| Should `draft.history` be JSONB or a separate table? | JSONB first, unless query needs require history-level indexing. |
| Should historical Mongo migration files remain in source? | Keep until the migration project is complete; then archive or remove from runtime path. |
| Should `search_documents` move to `tsvector` immediately? | No; preserve current denormalized model first. |

## 19. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Better Auth adapter schema diverges from current Mongo collections | Login/session/API key behavior can break at cutover. | Validate adapter schema before repository work; keep auth as its own phase with focused tests. |
| Snowflake worker ID collision | Duplicate primary keys under clustered runtime. | Fail fast on missing or duplicate worker ID; document deployment allocation. |
| JavaScript numeric precision loss | IDs can be corrupted in API responses or request handling. | Treat IDs as strings outside SQL; prohibit `Number(id)` conversions in repository tests. |
| Polymorphic references lose referential guarantees | Comments, recentlies, drafts, and AI rows can point to missing content. | Validate through migration reports and repository-level existence checks. |
| JSON fields contain historical malformed values | Migration can halt or silently corrupt metadata. | Parse deterministically; log malformed values; fail required fields and preserve optional raw values only by schema decision. |
| Aggregation rewrites change public metrics | Public aggregate endpoints regress despite typecheck passing. | Add behavior tests for counts, trends, top articles, category distribution, and tag cloud. |
| Backup restore becomes destructive | Data directory or SQL schema can be replaced unexpectedly. | Preserve current safety checks; verify restore in isolated staging before production use. |

## 20. PR Slicing and Implementation Checklist

### PR 1: PostgreSQL and Snowflake Foundation

**Files:**

- Create `apps/core/src/shared/id/entity-id.ts`.
- Create `apps/core/src/shared/id/snowflake.service.ts`.
- Create `apps/core/test/src/shared/id/snowflake.spec.ts`.
- Modify `apps/core/src/app.config.ts`.
- Modify `apps/core/src/app.config.test.ts`.
- Modify `apps/core/package.json`.

**Checklist:**

- [ ] Add `EntityId` parser/serializer and `zEntityId`.
- [ ] Add Snowflake generator with `bigint` arithmetic.
- [ ] Add worker ID configuration and fail-fast validation.
- [ ] Add tests for monotonicity, string serialization, sequence rollover, and clock rollback.
- [ ] Run `pnpm -C apps/core exec vitest run test/src/shared/id`.
- [ ] Run `pnpm -C apps/core exec tsc -p tsconfig.json --noEmit`.

### PR 2: SQL Schema and Database Provider

**Files:**

- Create `apps/core/src/processors/database/postgres.provider.ts`.
- Create `apps/core/src/processors/database/repository.tokens.ts`.
- Create `apps/core/src/database/schema/*.ts`.
- Create `apps/core/src/database/migrations/*.sql`.
- Modify `apps/core/src/processors/database/database.module.ts`.

**Checklist:**

- [ ] Add PostgreSQL pool and Drizzle database provider.
- [ ] Add baseline schema for categories, topics, posts, notes, pages, comments, readers, owner profiles, auth tables, AI tables, search documents, and operational tables.
- [ ] Add `schema_migrations`, `data_migration_runs`, and `mongo_id_map`.
- [ ] Add local/test PostgreSQL configuration.
- [ ] Run schema migration on a clean local PostgreSQL database.

### PR 3: Core Content Repositories

**Files:**

- Create `apps/core/src/modules/category/category.repository.ts`.
- Create `apps/core/src/modules/topic/topic.repository.ts`.
- Create `apps/core/src/modules/post/post.repository.ts`.
- Create `apps/core/src/modules/note/note.repository.ts`.
- Create `apps/core/src/modules/page/page.repository.ts`.
- Create `apps/core/src/modules/comment/comment.repository.ts`.
- Modify the corresponding services and controllers.

**Checklist:**

- [ ] Replace `findById`, `findOne`, `populate`, `lean`, and `paginate` behavior with explicit repository methods.
- [ ] Preserve public response shape, especially `id: string`.
- [ ] Preserve visibility filters for unpublished posts, protected notes, and scheduled notes.
- [ ] Preserve comment threading and reply count behavior.
- [ ] Run focused post, note, page, and comment tests.

### PR 4: Auth and Owner Repositories

**Files:**

- Create `apps/core/src/modules/auth/auth.repository.ts`.
- Modify `apps/core/src/modules/auth/auth.implement.ts`.
- Modify `apps/core/src/modules/auth/auth.service.ts`.
- Modify `apps/core/src/modules/owner/owner.service.ts`.
- Modify `apps/core/src/modules/reader/reader.service.ts`.
- Modify `apps/core/src/modules/serverless/serverless.service.ts`.

**Checklist:**

- [ ] Replace Better Auth Mongo adapter.
- [ ] Preserve username/password login.
- [ ] Preserve bcrypt legacy hash upgrade.
- [ ] Preserve API key creation, deletion, and verification.
- [ ] Preserve owner profile read/write behavior.
- [ ] Run focused auth and owner tests.

### PR 5: Aggregates, Search, AI, and Operational Data

**Files:**

- Modify `apps/core/src/modules/aggregate/aggregate.service.ts`.
- Modify `apps/core/src/modules/search/search.service.ts`.
- Modify `apps/core/src/modules/ai/**`.
- Modify `apps/core/src/modules/activity/activity.service.ts`.
- Modify `apps/core/src/modules/analyze/analyze.service.ts`.
- Modify `apps/core/src/modules/file/file-reference.service.ts`.
- Modify `apps/core/src/modules/serverless/**`.

**Checklist:**

- [ ] Rewrite `$group`, `$lookup`, `$dateToString`, and `aggregatePaginate` into SQL queries.
- [ ] Preserve search document denormalization first.
- [ ] Preserve AI summary, AI insights, AI translation, and translation entry lookup behavior.
- [ ] Preserve serverless storage isolation and log cleanup semantics.
- [ ] Run aggregate, search, AI, activity, and serverless tests.

### PR 6: Migration CLI

**Files:**

- Create `apps/core/scripts/migrate-mongo-to-postgres.ts`.
- Create `apps/core/src/migration/postgres-data-migration/**`.
- Modify `apps/core/package.json`.
- Create migration verification fixtures under `apps/core/test/src/migration`.

**Checklist:**

- [ ] Implement dry-run mode.
- [ ] Generate all `mongo_id_map` rows before loading dependent rows.
- [ ] Load tables in documented dependency order.
- [ ] Emit count report, missing-reference report, duplicate-key report, and checksum report.
- [ ] Fail on missing required references.
- [ ] Run migration tests against fixture Mongo data and PostgreSQL target.

### PR 7: Runtime Cleanup and Documentation

**Files:**

- Modify `README.md`.
- Modify `apps/core/readme.md`.
- Modify `docker-compose.server.yml`.
- Modify `apps/core/src/modules/backup/backup.service.ts`.
- Modify `apps/core/test/helper/db-mock.helper.ts`.
- Modify `apps/core/vitest.config.mts`.
- Modify `apps/core/package.json`.
- Modify root `package.json`.

**Checklist:**

- [ ] Replace Mongo local development instructions with PostgreSQL.
- [ ] Replace backup/restore implementation.
- [ ] Remove Mongo runtime dependencies.
- [ ] Remove `mongodb-memory-server` test setup.
- [ ] Run typecheck, bundle, and the database behavior test suite.

## 21. Acceptance Criteria

- Application runtime starts without MongoDB available.
- `rg "mongoose|@typegoose|mongodb" apps/core/src` has no runtime hits outside migration-source tooling or documented historical files.
- Public API responses expose `id` as string and never expose Mongo `_id`.
- PostgreSQL stores first-class entity IDs as `bigint`.
- All required ObjectId references are rewritten through `mongo_id_map`.
- Auth sign-in, API keys, owner lookup, post/note/page CRUD, comments, search indexing, AI summaries/translations, and backup restore pass behavioral verification.
- Documentation and Docker/local development instructions no longer instruct users to run MongoDB.
