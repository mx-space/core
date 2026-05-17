# DB performance optimization — locally measurable index + N+1 fixes

**Owner:** TBD (handoff to AI implementer)
**Drafted:** 2026-05-17
**Status:** Spec / not yet implemented

---

## 1. Context

Aggregate-style endpoints in mx-core (especially `GET /api/v2/aggregate`, `GET /api/v2/posts`, `GET /api/v2/notes`, `GET /api/v2/notes/latest`) are called by SSR consumers on every page render. A reading of the source against the Drizzle schema shows several patterns that defeat the planner:

- WHERE / ORDER BY columns that have no composite index covering them.
- Per-row N+1 fetches inside `Promise.all` (`attachCategory` for posts).
- Filters expressed as `extract(year from created_at)::int = ?`, which can't use a btree on `created_at`.
- An array-containment filter (`tags @> array[?]::text[]`) with no GIN index.

These cost CPU and disk reads on the DB side and round-trips between the API process and Postgres. The goal of this spec is to **close those gaps** and to make the improvement provable by running scripts in this repo against a local DB.

DB / query layer only. Process-level concerns (HTTP transport, caching, hosting) are out of scope.

## 2. Goal (local, reproducible)

Every target below is a script or `EXPLAIN` output the implementer can produce on their own laptop against a local Postgres seeded by §3.3.

### 2.1 Planner-level (qualitative — primary)

Against the seeded local DB defined in §3.3, `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` of each query in §3.2 must satisfy:

| Query (with representative params) | Pre-fix expected | Post-fix required |
| --- | --- | --- |
| Posts list, `publishedOnly=true`, page 1, size 10, default order | Bitmap / Seq Scan on `posts` or scan over `posts_created_at_idx` with `Filter: is_published` | `Index Scan` / `Index Only Scan` on `posts_published_created_at_idx` |
| Posts list, `categoryId=X`, `publishedOnly=true` | Seq Scan or two-step bitmap | `Index Scan` on `posts_category_published_created_idx` |
| Posts list, `tag='foo'` | Seq Scan on `posts` | `Bitmap Index Scan` on `posts_tags_gin_idx` |
| Posts list, `year=2025` (pre-fix uses `extract`) | Seq Scan, expression filter | After C2: `Index Scan` on the same btree (range scan on `created_at`) |
| Notes list visible, default order | Seq Scan or planner picking the wrong single-column index | `Index Scan` on `notes_published_public_created_idx` |
| Notes list visible, `year=2025` | Seq Scan + expression filter | After C2: `Index Scan` on `notes_created_at_idx` (or composite) |
| Posts list (size 10) — count of categories queries issued | 1 list + N=size individual category lookups | After C1: 1 list + 1 batched category lookup (so 2 total, not 11) |

Each row in this table must be backed by an `EXPLAIN` output checked into the PR description.

### 2.2 Wall-clock (quantitative — secondary, only on the documented seed)

Using the bench harness in §3.4, on the seeded dataset in §3.3, on a single-process local Postgres, the **mean of 100 warmed-up runs** of each request must improve by the listed factor vs. the same harness on the pre-fix code:

| Endpoint hit by the harness | Required relative improvement |
| --- | --- |
| `GET /api/v2/aggregate` | ≥ **2×** faster |
| `GET /api/v2/posts?page=1&size=10` | ≥ **2×** faster |
| `GET /api/v2/notes` (visible list, page 1, size 10) | ≥ **2×** faster |
| `GET /api/v2/notes/latest` | ≥ **1.5×** faster |

Why relative, not absolute: a laptop running everything in Docker has noisy timing. Relative numbers on the *same machine, same dataset, same minute* are credible; absolute numbers are not portable. Both numbers (before / after) must be captured by the same harness invocation and pasted into the PR description.

### 2.3 Write-path non-regression

Bench script (§3.4) also runs a write loop: 200 inserts each into `posts` and `notes`. Post-fix mean insert time must be **no more than 1.3×** the pre-fix mean. New indexes always cost something on write; this caps it.

### 2.4 Non-goals

No new caching layer. No query-engine swap. No external telemetry. The seeded local DB is the only environment under test.

## 3. Current state and reproduction setup

### 3.1 Existing Drizzle indexes (baseline — do NOT re-add)

`packages/db-schema/src/schema/content.ts`:

- **posts** (L77–80): `unique(slug)`, `index(modifiedAt)`, `index(createdAt)`, `index(categoryId)`
- **notes** (L133–140): `unique(nid)`, `unique(slug) WHERE slug IS NOT NULL`, `index(nid)`, `index(modifiedAt)`, `index(createdAt)`, `index(topicId)`
- **pages** (L161–162): `unique(slug)`, `index(order)`
- **post_related_posts** (L96–97): `unique(postId, relatedPostId)`, `index(relatedPostId)`
- **recentlies** (L187–188): `index(refType, refId)`, `index(createdAt)`
- **drafts** (L215–218): `index(refType, refId) WHERE refId IS NOT NULL`, `index(updatedAt)`
- **comments** (L297–305): `index(refType, refId, parentCommentId, pin, createdAt)`, `index(rootCommentId, createdAt)`, `index(readerId)`

### 3.2 Query paths that hurt

#### A. Posts list — `apps/core/src/modules/post/post.repository.ts`

Lines 94–158 — `list()`:

- Filters: `categoryId` (eq or IN), `isPublished`, `tag` (`tags @> array[?]::text[]`), `year` (`extract(year from created_at)::int = ?`).
- Default order: `pinAtDescNullsLast, desc(created_at)` (line 142). Other sort modes: `createdAt`, `modifiedAt`, `pinAt`.
- Runs two queries in parallel (rows + count) on the same WHERE.
- **N+1**: line 151–153 — `await Promise.all(rows.map(r => this.attachCategory(...)))` triggers one `categories.findFirst` per row. With `size=10`, that's **10 extra round-trips** on top of the list itself.
- **`tags @> array[$tag]::text[]`** (L114) — no GIN index, so full table scan whenever a tag filter is supplied.
- **`extract(year from created_at)::int = $year`** (L118) — defeats any btree on `created_at`.

#### B. Notes list — `apps/core/src/modules/note/note.repository.ts`

Lines 127–163 — `listVisible()` → `listInternal()`:

- Visibility predicate: `isPublished = true AND (publicAt IS NULL OR publicAt <= now())`.
- Filters: optional `year` (same `extract(year from created_at)` anti-pattern, L172).
- Order: `modifiedAt DESC` / `createdAt DESC` / `nid DESC` depending on options.
- No single index covers `(isPublished, publicAt, createdAt DESC)` — planner picks one column, scans, filters the rest in memory.

#### C. Aggregate — `apps/core/src/modules/aggregate/aggregate.service.ts`

Single endpoint fans out into multiple repository calls in parallel:

- `topActivity()` (L68–76): 4× `findRecent()` for notes / posts / says / recently.
- `getLatest()` (L78–104): more `findRecent()` calls, possibly merged.
- `getTimeline()` (L106–134): `findByYearForTimeline()` per type.

Each downstream call inherits the posts / notes index gaps. Fixing the underlying tables fixes aggregate transitively.

#### D. Categories — `apps/core/src/modules/category/category.repository.ts`

Lines 39–64 — `findAll()`: full `LEFT JOIN posts GROUP BY` to compute post counts per category. Cheap on small `categories` but worth caching if called per render.

Lines 67–95 — `findById()`: subquery counts posts per category. Does **not** restrict to `isPublished = true`, so the count includes drafts.

#### E. Comments / drafts / recentlies

Already covered by composite indexes. No action this round.

### 3.3 Seed dataset spec (required for any wall-clock claim)

Implementer must create a reproducible seed. Recommended file: `apps/core/scripts/seed-bench.ts` (new), invoked with `pnpm --filter @mx-space/core exec tsx scripts/seed-bench.ts`.

**Deterministic** — must seed with a fixed RNG seed so repeated runs produce the same dataset. Use `seedrandom` or a hand-rolled LCG; `@faker-js/faker` accepts `faker.seed(42)`.

| Table | Row count | Notes |
| --- | --- | --- |
| `categories` | 20 | Distinct names + slugs |
| `topics` | 40 | Distinct names + slugs |
| `posts` | **2000** | `is_published`: 90% true. `category_id`: uniform random over the 20 categories. `tags`: 0–5 tags pulled from a fixed 50-tag pool. `pin_at`: NULL for 95%, recent timestamp for the rest. `created_at`: uniform across the last 3 years. `modified_at >= created_at`. |
| `notes` | **1500** | `is_published`: 95% true. `public_at`: NULL for 60%, past timestamp for 30%, future timestamp for 10%. `topic_id`: NULL for 50%, otherwise random. `created_at`: uniform across the last 3 years. |
| `pages` | 30 | `order` uniform 0–29. |
| `comments` | 5000 | Distributed over posts + notes. Not central to this spec but realistic. |
| `recentlies` | 500 | Mixed refs. |

These sizes are picked to push Postgres past the "small table — seq scan is always cheaper" threshold while still seeding in < 30 s on a laptop. Do **not** scale up further — the goal is repeatable comparison, not absolute throughput.

After seeding, the script must `ANALYZE` all affected tables so planner stats are fresh.

### 3.4 Bench harness spec (required for §2.2 / §2.3)

New file: `apps/core/scripts/bench-db-perf.ts` (or similar). Responsibilities:

1. Boot mx-core in-process (`NestFactory.create(AppModule.register(true))`) against the seeded local DB. Avoid HTTP overhead — call controllers / services directly, or use `app.getHttpAdapter()` with a loopback fetch — whichever is more stable.
2. For each endpoint in §2.2:
   - 20 warm-up calls (results discarded).
   - 100 measured calls. Record per-call duration via `performance.now()`.
   - Report mean, median, p95, min, max.
3. Run the read endpoints first, then the write loop in §2.3 (200 inserts each on posts and notes).
4. Print a single Markdown table to stdout so it can be pasted directly into the PR description.
5. Accept an env flag `MX_BENCH_LABEL=before|after` so two runs can be compared.

Crucial details:

- Bench must run after a fresh `ANALYZE`.
- Bench must call `setImmediate` / `await Promise.resolve()` between iterations to keep the loop fair across the connection pool.
- Bench must not enable the slow log (signal-vs-noise); slow log is only for Phase A discovery.

### 3.5 Phase A — slow log on local PG (one-time exploration)

Before touching schema, capture the planner's actual behaviour on the seeded DB. This validates the predicted hot spots.

Local docker-compose has a `postgres:16-alpine` service. Enable slow logging by one of:

1. **No-restart** — from the host:
   ```bash
   docker compose exec postgres psql -U <user> -d <db> -c \
     "ALTER SYSTEM SET log_min_duration_statement = 20;
      ALTER SYSTEM SET log_statement = 'none';
      ALTER SYSTEM SET log_temp_files = 0;
      SELECT pg_reload_conf();"
   ```
2. **Compose override** — add to `docker-compose.yml` postgres service `command`:
   ```
   command: postgres -c log_min_duration_statement=20 -c log_statement=none -c log_temp_files=0
   ```

20 ms (not 100) because we're on a laptop with a small dataset — anything over 20 ms on this seed is interesting.

Run the bench harness once (`MX_BENCH_LABEL=before`), capture matching slow log lines with `docker compose logs postgres | grep "duration:" | sort -k7 -n | tail -50`, and paste the top 20 into the PR description. These are the queries the rest of this spec targets.

## 4. Plan

### Phase B — Add missing indexes

All schema diffs live in `packages/db-schema/src/schema/content.ts`. After editing, run `pnpm drizzle-kit generate` and hand-edit the resulting SQL to use `CONCURRENTLY` (see §5).

#### B1. posts — published-time-series index (highest ROI)

```ts
index('posts_published_created_at_idx').on(table.isPublished, table.createdAt.desc()),
```

Covers: aggregate `topActivity` (published posts ordered by createdAt), posts list with `publishedOnly=true`, posts list default order when `pinAt` is mostly NULL.

#### B2. notes — visibility composite

```ts
index('notes_published_public_created_idx').on(
  table.isPublished,
  table.publicAt,
  table.createdAt.desc(),
),
```

Covers: `listVisible()` predicate `isPublished = true AND (publicAt IS NULL OR publicAt <= now())` ordered by `createdAt DESC`. Including `publicAt` in the index keeps the visibility filter from re-reading the heap.

A partial index using `WHERE ... now()` is **not** an option — `now()` is not immutable and Postgres rejects it in index predicates.

#### B3. posts — category-scoped feed

```ts
index('posts_category_published_created_idx').on(
  table.categoryId,
  table.isPublished,
  table.createdAt.desc(),
),
```

Covers: category pages and any category-filtered list. Keep the existing `posts_category_id_idx` unless `EXPLAIN` on the seeded DB shows this one fully supersedes it.

#### B4. posts — tag GIN

```ts
index('posts_tags_gin_idx').using('gin', table.tags),
```

Covers: `tags @> array[$tag]::text[]`. Required to satisfy the planner row in §2.1 — even if §3.5's slow log doesn't pick it up (it might not if the bench doesn't exercise tag filtering), include it because tag pages exist in the consumer.

#### B5. pages — order + createdAt composite (conditional)

```ts
index('pages_order_created_idx').on(table.order, table.createdAt),
```

Marginal. Include **only** if Phase A slow log shows `pages` queries hot. Otherwise skip and note as a follow-up.

### Phase C — Code fixes (no schema change)

#### C1. Batch `attachCategory()` in `post.repository.ts`

Find every site where `attachCategory` (or equivalent) is called inside `.map` / `Promise.all`. Refactor to:

1. Collect `categoryId`s from the row set.
2. Single `db.select().from(categories).where(inArray(categories.id, ids))`.
3. Build a Map; stitch back into rows.

`note.repository.ts` `attachTopics` already implements this pattern — mirror the shape.

Verification: bench harness in §3.4 reports a "queries-issued" count per call. After C1, posts-list size=10 must drop from 11 queries to 2 (one list, one batched category fetch).

#### C2. Replace `extract(year from created_at) = $year` with a range scan

Both `post.repository.ts:116-119` and `note.repository.ts:171-173`:

```ts
// before
filters.push(sql`extract(year from ${posts.createdAt})::int = ${params.year}`)

// after
const start = new Date(Date.UTC(params.year, 0, 1))
const end = new Date(Date.UTC(params.year + 1, 0, 1))
filters.push(gte(posts.createdAt, start))
filters.push(lt(posts.createdAt, end))
```

Confirms via `EXPLAIN` row in §2.1.

#### C3. (Optional) Memoize `categories.findAll()` post-count join

`apps/core/src/modules/category/category.repository.ts:39–64` does a full LEFT JOIN GROUP BY on every call. Add a TTL cache (60 s) only if Phase A's slow log shows this query above 20 ms. Otherwise skip.

### Phase D — Out-of-scope follow-ups (file as separate tickets)

- `ilike(title, '%...%')` on posts (`post.repository.ts:292`) — needs `pg_trgm` GIN or external search.
- HTTP keep-alive between API consumers and mx-core.
- Container CPU / memory caps.
- CDN cache rules for HTML.

## 5. Migration safety

`drizzle-kit generate` will emit `CREATE INDEX IF NOT EXISTS ...`. **Hand-edit** the generated `.sql`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "posts_published_created_at_idx"
  ON "posts" ("is_published", "created_at" DESC);
```

`CONCURRENTLY` keeps the table available for reads + writes while the index builds. Without it, `CREATE INDEX` takes `ACCESS EXCLUSIVE` and blocks every read and write on the table until done.

Caveats:

- **Must run outside a transaction.** Confirm by inspecting `apps/core/src/database/app-migrations/` — does the runner wrap each `.sql` in `BEGIN/COMMIT`? If yes, split index creation into a separate, idempotent step (or run them via a non-transactional CLI). On a local DB this is safe to test directly.
- **A failed `CONCURRENTLY` build leaves an `INVALID` index.** Detection:
  ```sql
  SELECT indexrelid::regclass FROM pg_index WHERE indisvalid = false;
  ```
  Recovery: `DROP INDEX CONCURRENTLY <name>;` and re-run.

For Phase C (code-only refactors), no migration concerns.

## 6. Verification (all local)

After each phase, the implementer must produce the following artefacts and paste them into the PR description. Anything that can't be produced locally is a bug in the spec — flag it.

### 6.1 Slow-log capture (Phase A artefact)

`docker compose logs postgres | grep "duration:" | sort -k7 -n | tail -30` — top 20 lines from a fresh bench run.

### 6.2 `EXPLAIN (ANALYZE, BUFFERS)` for each row in §2.1

Connect to the local seeded DB via `docker compose exec postgres psql -U <user> -d <db>` and run:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM posts
WHERE is_published = true
ORDER BY pin_at DESC NULLS LAST, created_at DESC
LIMIT 10;
-- repeat for each query in §2.1
```

Each `EXPLAIN` must show the index name predicted in §2.1's "Post-fix required" column.

### 6.3 Bench comparison (§2.2 + §2.3 artefact)

Run twice on the **same machine, same docker stack, within ~10 minutes**:

```bash
MX_BENCH_LABEL=before pnpm --filter @mx-space/core exec tsx scripts/bench-db-perf.ts > bench-before.md
# apply Phase B + C
MX_BENCH_LABEL=after  pnpm --filter @mx-space/core exec tsx scripts/bench-db-perf.ts > bench-after.md
```

Paste both Markdown tables side by side. Compute the speed-up factor per endpoint. Confirm §2.2 (≥ 2× reads) and §2.3 (≤ 1.3× writes) hold.

### 6.4 INVALID index check

After running migrations, `SELECT indexrelid::regclass FROM pg_index WHERE indisvalid = false;` must return zero rows.

### 6.5 Test suite

`pnpm --filter @mx-space/core test` and any repository-level vitest must still pass. Add new tests only if needed to lock in the N+1 fix (e.g. a unit test counting categories queries).

## 7. File-by-file change manifest

- `packages/db-schema/src/schema/content.ts` — index declarations B1, B2, B3, B4 (B5 conditional).
- `apps/core/src/database/migrations/<timestamp>_<slug>.sql` — generated migration, hand-edited to `CREATE INDEX CONCURRENTLY`.
- `apps/core/src/modules/post/post.repository.ts` — C1 (batched `attachCategory`) and C2 (year range filter).
- `apps/core/src/modules/note/note.repository.ts` — C2 (year range filter).
- `apps/core/src/modules/category/category.repository.ts` — C3 (memoize `findAll`), conditional.
- `apps/core/scripts/seed-bench.ts` — **new**, deterministic seeder per §3.3.
- `apps/core/scripts/bench-db-perf.ts` — **new**, harness per §3.4.
- `docker-compose.yml` (optional) — postgres `command:` override for slow log; revertable.

## 8. Acceptance checklist (handoff — paste into PR)

- [ ] Local docker stack is up; seed script run; `ANALYZE` performed.
- [ ] `bench-before.md` produced (without applying any fixes).
- [ ] Slow log captured per §6.1.
- [ ] Phase B indexes added; migration hand-edited to `CONCURRENTLY`; migration runs cleanly on local DB.
- [ ] `EXPLAIN` outputs per §6.2 attached; each shows the predicted index.
- [ ] Phase C code fixes shipped; existing tests pass.
- [ ] `bench-after.md` produced; pasted side-by-side with `bench-before.md`; targets in §2.2 and §2.3 met.
- [ ] §6.4 returns zero invalid indexes.
- [ ] Phase D items filed as separate issues, not bundled.
- [ ] Slow-log compose override (if used) reverted before merge.

## 9. References

- Drizzle index API: https://orm.drizzle.team/docs/indexes-constraints
- PG `CREATE INDEX CONCURRENTLY`: https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY
- PG slow query logging: https://www.postgresql.org/docs/current/runtime-config-logging.html#GUC-LOG-MIN-DURATION-STATEMENT
- PG `EXPLAIN`: https://www.postgresql.org/docs/current/sql-explain.html
