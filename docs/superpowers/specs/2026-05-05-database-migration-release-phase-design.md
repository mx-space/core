# Database migrations as a release phase

**Status:** Approved (brainstorming)
**Date:** 2026-05-05
**Author:** Innei
**Related:** Better Auth passkey transports fix (master @ HEAD), drizzle migrator behavior

## 1. Problem

Schema migrations currently run inside the NestJS app boot sequence, in
`apps/core/src/processors/database/postgres.provider.ts` via the
`PG_POOL_TOKEN` factory calling `applyMigrations(db)`. Drizzle's
`node-postgres` migrator does not take any advisory lock — it runs:

```
CREATE SCHEMA IF NOT EXISTS drizzle
CREATE TABLE IF NOT EXISTS __drizzle_migrations
SELECT last hash
BEGIN; <run pending SQL>; INSERT hash; COMMIT
```

This works only for a single-replica deploy. The project supports two
production shapes:

1. **Self-host (project owner):** Dokploy + 2 replicas, rolling deploy with
   `update_config: { order: start-first, parallelism: 1 }`.
2. **Other users:** plain `docker compose up` single instance.

Under shape (1), N replicas all start concurrently against the same
database. Both replicas read the same `lastDbMigration`, both enter their
transactions, and both attempt the DDL — colliding on `CREATE TABLE`,
`ALTER COLUMN`, unique constraints, etc. The current behavior is
unsound, and shape (1) is already comment-flagged in
`docker-stack.server.yml` ("set replicas to 1 first").

Even fixing the race with an advisory lock keeps several latent issues:

- migration failure puts every replica into a restart loop
- long migrations block all replicas' boot
- rollback is awkward — old image starts, sees newer schema, may
  partially "re-migrate" or fail on incompatible queries
- failure has no separate observability (no named release step)

## 2. Goal

Adopt the canonical industry pattern (12-Factor "release phase",
Kubernetes `Job` / `initContainer`, Heroku release phase, Rails
`rake db:migrate`):

- Schema migrations run as a **dedicated, one-shot, pre-deploy step**.
- App startup **verifies** schema is current and **fails fast** if
  behind. App never mutates schema.
- Behavior is identical across `dev` and `production` to avoid
  environment-specific surprises.
- Multi-replica safety is by **construction** (release-phase ordering),
  not by ad-hoc locks. Advisory lock remains as defense in depth against
  operator-side concurrent invocations.

## 3. Non-goals

- Replace drizzle as the migration tool.
- Add a "down migration" framework (drizzle does not provide one).
- Cover the historical Mongo→PG one-shot data migration (`apps/core/scripts/migrate-mongo-to-postgres.ts`); that script is run manually outside this flow.
- Support Docker Swarm (`docker-stack.server.yml` is being removed; it is
  Mongo-era and the current owner does not use Swarm).
- Build a UI / dashboard for migration status.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Release Pipeline                             │
│                                                                      │
│  CI build image  ──►  Push to registry  ──►  Deploy hook fired       │
│                                                                      │
│  Deploy compose / Dokploy:                                           │
│   1. postgres healthy                                                │
│   2. mx-migrate (one-shot)   ──► node migrate.mjs                    │
│       ├─ pg_advisory_lock (defense in depth)                         │
│       ├─ drizzleMigrate(__drizzle_migrations)                        │
│       └─ exit 0  (or fail → block step 3)                            │
│   3. mx-core (replicas: 1..N)                                        │
│       └─ assertSchemaCurrent() at boot                               │
│           ├─ ok      → start Nest                                    │
│           └─ behind  → throw, exit 1                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.1 Invariants

1. `mx-core` reads schema state, never writes it. Schema mutation is
   solely the responsibility of `mx-migrate`.
2. `service_completed_successfully` (compose v2.17+) prevents `mx-core`
   from starting before `mx-migrate` exits 0.
3. Advisory lock inside `migrate.mjs` guards against operator-side
   concurrent invocations (e.g. two `docker compose up` runs in
   parallel, double-fired Dokploy webhook, manual `pnpm migrate` while
   pipeline is also running).
4. Dev mode is not exempt. `pnpm migrate` is run explicitly (or via
   `predev` hook); the app fails fast if schema is behind.

### 4.2 Module map

| Module | File | Status | Responsibility |
|---|---|---|---|
| Migration runner | `apps/core/src/bin/migrate.ts` | new | One-shot execution; pg pool + drizzle migrator + advisory lock; no Nest |
| Boot guard | `apps/core/src/processors/database/postgres.provider.ts` | modify | Replace `applyMigrations()` with `assertSchemaCurrent()` |
| Advisory lock util | `apps/core/src/processors/database/postgres.lock.ts` | new | `withAdvisoryLock(pool, key, fn)` |
| Init check | `apps/core/src/utils/check-init.util.ts` | modify | Drop the `applyMigrations` call; `checkInit` becomes pure read |
| Bundle config | `apps/core/tsdown.config.ts` | modify | Add `bin/migrate.ts` as second entry |
| package scripts | `apps/core/package.json` | modify | `migrate`, `predev`, `lint:migrations` |
| Compose | `docker-compose.yml`, `docker-compose.server.yml` | modify | Add `mx-migrate` one-shot service |
| Stack file | `docker-stack.server.yml` | delete | Mongo-era, Swarm-only, unused |
| Lint guard | `apps/core/scripts/lint-migrations.ts` | new | Static SQL pattern scanner |
| CI | `.github/workflows/release.yml` | modify | Add `lint:migrations` step + explicit migrate before bundle test |
| Test helper | `apps/core/test/helper/pg-testcontainer.ts` | modify | Apply drizzle migrations after container starts (replaces implicit boot-time migration) |
| Claude skill | `.claude/skills/mx-migration-author/SKILL.md` | new | AI authoring/review aid |
| Docs | `apps/core/readme.md`, `CLAUDE.md`, `.github/PULL_REQUEST_TEMPLATE.md` | modify | Document the new flow |

## 5. Components

### 5.1 `apps/core/src/bin/migrate.ts`

Pure pg + drizzle, no Nest. Reads `MIGRATIONS_DIR` env (set by
`dockerfile` to `/app/migrations`) or defaults to
`src/database/migrations`.

```ts
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator'
import pkg from 'pg'

import { POSTGRES } from '~/app.config'
import * as schema from '~/database/schema'
import { withAdvisoryLock } from '~/processors/database/postgres.lock'

const { Pool } = pkg
const ADVISORY_LOCK_KEY = 7283649120384756n // see §5.3

async function main() {
  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    max: 2,
    ssl: POSTGRES.ssl,
  })
  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const migrationsFolder = process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.resolve(process.cwd(), 'src', 'database', 'migrations')

  console.log(`[migrate] folder=${migrationsFolder}`)
  const start = Date.now()
  await withAdvisoryLock(pool, ADVISORY_LOCK_KEY, async () => {
    await drizzleMigrate(db, { migrationsFolder })
  })
  console.log(`[migrate] done in ${Date.now() - start}ms`)
  await pool.end()
}

main().catch((err) => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
```

Exit codes: `0` success, `1` failure. compose `service_completed_successfully` keys off this.

### 5.2 `apps/core/src/processors/database/postgres.lock.ts`

```ts
import type pkg from 'pg'

export async function withAdvisoryLock<T>(
  pool: pkg.Pool,
  key: bigint,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query(`SET lock_timeout = '60s'`)
    await client.query('SELECT pg_advisory_lock($1)', [key.toString()])
    return await fn()
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [key.toString()])
    } catch (e) {
      console.warn(
        '[advisory-lock] unlock failed (will release on disconnect):',
        e,
      )
    }
    client.release()
  }
}
```

`bigint` passed as string to avoid JS Number precision loss. Lock is bound
to the connection; `client.release()` returns the connection to the pool
and frees the lock implicitly.

### 5.3 Advisory lock key

`pg_advisory_lock` takes a single `bigint`. We pick a project-specific
constant to avoid collision with any other tooling that might use
advisory locks against the same database.

```
key = first 8 bytes of sha256("mx-core:schema-migration:v1") interpreted as signed bigint
key = 7283649120384756n  // computed once; fixed forever
```

A unit test asserts the constant matches the SHA-256 derivation, so an
accidental change is caught.

### 5.4 `postgres.provider.ts` changes

Remove `applyMigrations` from the `PG_POOL_TOKEN` factory and replace
with `assertSchemaCurrent`:

```ts
import { readMigrationFiles } from 'drizzle-orm/migrator'

class SchemaBehindError extends Error {
  constructor(
    public expectedTimestamp: number,
    public actualTimestamp: string | null,
    public expectedHash: string | undefined,
  ) {
    super(
      `Schema is behind. Expected migration timestamp ${expectedTimestamp} ` +
        `(hash=${expectedHash ?? 'n/a'}), database has ` +
        `${actualTimestamp ?? '<none>'}. Run "node migrate.mjs" as a release ` +
        `step before starting the app.`,
    )
    this.name = 'SchemaBehindError'
  }
}

class MigrationDriftError extends Error {
  constructor(
    public timestamp: number,
    public expectedHash: string,
    public actualHash: string,
  ) {
    super(
      `Migration drift detected at timestamp ${timestamp}: expected hash ` +
        `${expectedHash}, database has ${actualHash}. A migration that was ` +
        `already applied has been edited; this is not safe to recover ` +
        `automatically.`,
    )
    this.name = 'MigrationDriftError'
  }
}

async function assertSchemaCurrent(
  db: AppDatabase,
  migrationsFolder: string,
): Promise<void> {
  const files = readMigrationFiles({ migrationsFolder })
  const last = files.at(-1)
  if (!last) return // no migrations bundled — only possible for a fresh repo

  const tableExists = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `)
  if (!tableExists.rows[0]?.exists) {
    throw new SchemaBehindError(last.folderMillis, null, last.hash)
  }

  const result = await db.execute<{ created_at: string; hash: string }>(sql`
    SELECT created_at, hash FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC LIMIT 1
  `)
  const latest = result.rows[0]
  if (!latest || Number(latest.created_at) < last.folderMillis) {
    throw new SchemaBehindError(
      last.folderMillis,
      latest?.created_at ?? null,
      last.hash,
    )
  }
  if (
    Number(latest.created_at) === last.folderMillis &&
    latest.hash !== last.hash
  ) {
    throw new MigrationDriftError(last.folderMillis, last.hash, latest.hash)
  }
}
```

The factory becomes:

```ts
{
  provide: PG_POOL_TOKEN,
  useFactory: async () => {
    const pool = await createPool()
    const db = createDb(pool)
    await assertSchemaCurrent(db, resolveMigrationsFolder())
    return pool
  },
},
```

`resolveMigrationsFolder()` mirrors the same `MIGRATIONS_DIR ||
defaultPath` resolution used in `migrate.ts`.

`apps/core/src/utils/check-init.util.ts` currently calls `applyMigrations(db)`
in its `checkInit()` helper (invoked from `bootstrap.ts:33` and
`init.guard.ts`). After this design, that call is removed — `checkInit`
becomes a pure read: count owners, return boolean. By the time
`checkInit` runs, the boot guard has already verified the schema, so the
migration call is redundant. The legacy `applyMigrations` export is
removed entirely.

### 5.5 CI lint guard

`apps/core/scripts/lint-migrations.ts`:

```ts
type Risk = {
  file: string
  line: number
  rule: string
  snippet: string
  hint: string
}

const RULES = [
  {
    rule: 'no-drop-column',
    re: /\bALTER\s+TABLE\s+.+?\s+DROP\s+COLUMN\b/i,
    hint: 'Drop column requires staging across two releases: stop writing the column, then drop it.',
  },
  {
    rule: 'no-drop-table',
    re: /\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)/i,
    hint: 'Use DROP TABLE IF EXISTS, and confirm no consumers reference it.',
  },
  {
    rule: 'no-bare-not-null-add',
    re: /\bADD\s+COLUMN\b(?:(?!DEFAULT).)*\bNOT\s+NULL\b/is,
    hint: 'Adding NOT NULL requires a DEFAULT, or split into three steps: add nullable, backfill, then SET NOT NULL.',
  },
  {
    rule: 'no-rename-column',
    re: /\bRENAME\s+COLUMN\b/i,
    hint: 'Rename breaks old replicas. Use expand-contract: add new column, dual-write, cut over, then drop old.',
  },
  {
    rule: 'no-alter-type',
    re: /\bALTER\s+COLUMN\s+\w+\s+(?:SET\s+DATA\s+)?TYPE\b/i,
    hint: 'Type change can lock the entire table and break old replicas. Prefer add new column + backfill + cutover.',
  },
  {
    rule: 'no-bare-create-index',
    re: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
    hint: 'Large-table index creation should use CREATE INDEX CONCURRENTLY, outside a transaction.',
  },
] as const

const BASELINE = '0003' // migrations whose number ≤ this are exempt
```

**Allow annotation** (line-prefixed comment on the same or previous line):

```sql
-- migration-lint:allow=no-drop-column reason=baseline cutover, no consumers yet
ALTER TABLE foo DROP COLUMN bar;
```

`reason=` is required; bare `migration-lint:allow=*` without a reason is a
lint error itself. CI runs the lint as part of the `quality` job.

### 5.6 Claude skill: `mx-migration-author`

Lives at `.claude/skills/mx-migration-author/SKILL.md`. Activated when:

- editing `apps/core/src/database/schema/*.ts`
- creating `apps/core/src/database/migrations/*.sql`
- running `drizzle-kit generate`
- `lint:migrations` reports a rule violation
- prompts mention "迁移", "alter table", "改 schema", "add a column", etc.

Skill enforces the **expand-contract decision tree** (§ in skill body):

| Operation | Required staging |
|---|---|
| Add nullable column | one release |
| Add NOT NULL column | three releases (add nullable → backfill → SET NOT NULL) |
| Add index, large table | CONCURRENTLY, bypass transaction |
| Add FK, large table | NOT VALID, then VALIDATE CONSTRAINT (two releases) |
| Drop column | two releases (stop using → drop) |
| Rename column | four releases (add new → dual-write → cutover → drop old) |
| Type change | four releases (add new → backfill → cutover → drop old) |
| Drop NOT NULL | one release |
| Drop table | two releases |
| Drop index | one release |

Skill includes:

- worked examples for each row
- a 7-item self-checklist the skill runs after generating a migration
- guidance on when to write a `migration-lint:allow=` annotation (always
  include `reason=`, never blanket `*`)
- pointers to `mx-review` and `release-core` skills

### 5.7 Compose changes

`docker-compose.yml`:

```yaml
services:
  app:
    container_name: mx-server
    image: innei/mx-server:latest
    environment: # …existing
    volumes: ['./data/mx-space:/root/.mx-space']
    ports: ['2333:2333']
    depends_on:
      mx-migrate:
        condition: service_completed_successfully
      redis:
        condition: service_started
    networks: [mx-space]
    restart: unless-stopped
    healthcheck: # …existing

  mx-migrate:
    image: innei/mx-server:latest
    container_name: mx-migrate
    command: ['node', 'migrate.mjs']
    environment: # same PG_*, ENCRYPT_*, etc. as app
    depends_on:
      postgres:
        condition: service_healthy
    networks: [mx-space]
    restart: 'no'

  postgres: # …existing
  redis: # …existing
```

`docker-compose.server.yml` mirrors the same shape with the prod
environment variables.

`docker-stack.server.yml` is deleted; `scripts/workflow/test-docker.sh`
references checked.

### 5.8 tsdown multi-entry

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: false,
  target: 'es2023',
  entry: ['src/main.ts', 'src/bin/migrate.ts'],
  dts: false,
  platform: 'node',
  noExternal: () => true,
  format: ['esm'],
  outDir: 'out',
  sourcemap: true,
  shims: true,
  inlineOnly: false,
})
```

Produces `out/main.mjs` (existing) and `out/migrate.mjs` (new).
`dockerfile` already copies `apps/core/src/database/migrations` to
`out/migrations` and exposes `MIGRATIONS_DIR=/app/migrations`; no change
needed there.

### 5.9 Dev workflow

`apps/core/package.json`:

```jsonc
{
  "scripts": {
    "migrate": "tsx --tsconfig tsconfig.json src/bin/migrate.ts",
    "predev": "npm run migrate",
    "lint:migrations": "tsx scripts/lint-migrations.ts"
  }
}
```

`predev` makes `pnpm dev` chain `pnpm migrate` automatically. Tests do
not go through the boot guard — they call drizzle's migrator directly via
the existing `pg-testcontainer` helper, and may use the `__setTestPostgresInstance` test override that already exists.

## 6. Data flow

### 6.1 Production deploy (Dokploy, 2 replicas)

```
t=0  Dokploy webhook fired (release.yml :merge done)
t=1  Dokploy pulls new image
t=2  Dokploy brings the compose project up:
       postgres: already healthy (always-on)
       redis:    already healthy
       mx-migrate: starts → node migrate.mjs
                    pg_advisory_lock(KEY)
                    drizzleMigrate() applies pending SQL
                    pg_advisory_unlock(KEY)
                    exit 0  ← service_completed_successfully met
       mx-core (new replicas): start → assertSchemaCurrent() ok → Nest boots
       mx-core (old replicas): drained per Dokploy's rolling strategy
t=N  rollout complete
```

The replica-rolling semantics (start-first vs stop-first, parallelism,
healthcheck-gated cutover) are owned by Dokploy's deploy strategy, not by
the compose file. This design only guarantees that `mx-migrate` runs to
completion before any `mx-core` container starts; rolling specifics are
out of scope.

### 6.2 Single-instance compose

```
docker compose up
  postgres healthcheck → healthy
  mx-migrate           → runs, exits 0
  app                  → assertSchemaCurrent() ok → boot
```

## 7. Error handling

| Failure | Effect |
|---|---|
| `postgres` unhealthy | `mx-migrate` does not start (depends_on healthy). Dokploy deploy times out → alert. |
| `migrate.mjs` throws (bad SQL) | Exit 1. compose does not enter `mx-core` phase. Old image keeps serving. |
| Advisory lock timeout (>60s) | `lock_timeout` set in `withAdvisoryLock`. Failed query → exit 1. |
| `assertSchemaCurrent` fails on boot | Nest factory throws. Process exits 1. Compose `restart: unless-stopped` retries; Dokploy `failure_action: rollback` triggers rollback. |
| Migration drift (hash mismatch) | `MigrationDriftError` thrown — explicit, requires manual recovery. |
| `lint:migrations` fails in CI | `quality` job fails; merge blocked; release aborts. |

## 8. Testing

### 8.1 Unit
- `postgres.lock.spec.ts` — testcontainer pg, two clients race for the lock, verify mutual exclusion.
- `lint-migrations.spec.ts` — fixture SQL files exercising each rule and the allow annotation, including missing-`reason` rejection and baseline-cutoff exemption.
- `assert-schema-current.spec.ts` — testcontainer fixtures for: fresh DB, synced, behind, drift.
- `advisory-lock-key.spec.ts` — verifies the constant equals the SHA-256 derivation.

### 8.2 Integration / e2e
- `migrate-binary.e2e.spec.ts` — testcontainer + child_process spawn `node out/migrate.mjs`, assert exit code and `__drizzle_migrations` row.
- `boot-guard.e2e.spec.ts` — `createE2EApp` against a non-migrated db, expect `SchemaBehindError`.

### 8.3 CI
- `quality` job: add `pnpm -C apps/core run lint:migrations`.
- `build` job: the existing `Test Bundle Server` step exercises `out/main.mjs`. With the new boot guard, that bundle now requires the schema to be current. Add a preceding step that runs `node apps/core/out/migrate.mjs` against the CI postgres service before the bundle test starts.
- `docker` job: extend `scripts/workflow/test-docker.sh` to confirm `mx-migrate` runs to completion and `app` then becomes healthy. Failure of either causes the docker test to fail.

### 8.4 Test helper migration

`test/helper/pg-testcontainer.ts` currently only starts the container. The
helper grows a small post-start hook that calls drizzle's migrator
against the started container's connection URL, so per-suite test
databases land at the bundled schema before any test runs. Existing
test files do not change.

## 9. Rollout

Order is dependency-driven. Each step is independently reviewable.

1. **Foundations**
   - Add `postgres.lock.ts` + unit test.
   - Add `bin/migrate.ts`.
   - Modify `tsdown.config.ts` (multi-entry).
   - Modify `package.json` (scripts).
   - Verify `pnpm migrate` runs locally end-to-end.
2. **Boot guard**
   - Modify `postgres.provider.ts`: replace `applyMigrations` with `assertSchemaCurrent`.
   - Modify `apps/core/src/utils/check-init.util.ts`: drop the `applyMigrations` call; `checkInit` becomes a pure read.
   - Remove the `applyMigrations` export.
   - Modify `test/helper/pg-testcontainer.ts`: apply drizzle migrations after the container starts.
   - Unit + e2e tests.
3. **Lint guard**
   - Add `scripts/lint-migrations.ts` + fixtures.
   - Set baseline cutoff = `0003`.
   - Modify `release.yml` (`quality` job).
4. **Compose / dockerfile**
   - Modify `docker-compose.yml` and `docker-compose.server.yml`: add `mx-migrate` service.
   - Verify `out/migrate.mjs` exists in the image (automatic via tsdown multi-entry).
   - Delete `docker-stack.server.yml` and check references in `scripts/workflow/test-docker.sh`.
   - Verify `docker compose up --build` locally.
5. **Claude skill**
   - Add `.claude/skills/mx-migration-author/SKILL.md`.
   - Cross-reference from `mx-review` and `release-core` skills.
6. **Documentation**
   - `apps/core/readme.md`: add migration workflow section.
   - `CLAUDE.md`: cross-reference the new skill.
   - `.github/PULL_REQUEST_TEMPLATE.md`: migration checklist.
7. **CI pipeline final**
   - Confirm `release.yml` gates: lint:migrations in `quality`, `mx-migrate` exercised in `build`, dokploy step unchanged.

## 10. Open questions

None at design time. Concrete implementation choices (test fixture
shapes, exact wording of the PR template) are deferred to the
implementation plan.
