# Comments backfill scripts

PR2 of the admin `/comments` redesign (spec
`docs/superpowers/specs/2026-06-02-admin-comments-redesign-design.md` §6.5).
The expand-only migration in PR1 added two nullable / defaulted columns:

- `comments.is_owner_reply BOOLEAN NOT NULL DEFAULT FALSE`
- `comments.country_code   TEXT`

These scripts populate the historical data. Both are idempotent — re-running
them on an already-backfilled dataset is a no-op (the read predicate excludes
already-populated rows). Both are resumable — chunk-by-id means a SIGINT just
stops mid-batch and the next run picks up automatically.

## Environment

Same `PG_*` and `REDIS_*` variables the app reads (see
`apps/core/src/app.config.ts`). The scripts read `process.env` directly — no
extra `.env` loader is wired in, so prefer prefixing the command:

```sh
PG_URL=postgresql://mx:mx@localhost:5432/mx_core \
REDIS_URL=redis://localhost:6379 \
pnpm -C apps/core exec tsx scripts/backfill-owner-reply.ts --mode apply
```

In a Dokploy environment, run inside the running app pod:

```sh
docker exec -it <core-pod> node --import tsx/esm \
  /app/apps/core/scripts/backfill-owner-reply.ts --mode apply
```

## `scripts/backfill-owner-reply.ts`

Flags historical replies authored by the site owner (`is_owner_reply = true`).
Detection: the reader row with `role='owner'` (its `id` + `email`) plus
`owner_profiles.mail`. A reply is attributed to the owner when:

- `comments.reader_id` equals the owner reader id, OR
- `lower(comments.mail)` matches one of the known owner mails.

Root comments (`parent_comment_id IS NULL`) are never owner replies.

```sh
# inspect what will change
pnpm -C apps/core exec tsx scripts/backfill-owner-reply.ts --mode dry-run

# apply
pnpm -C apps/core exec tsx scripts/backfill-owner-reply.ts --mode apply
```

Expected runtime: ~5s per 10k rows on a hot DB (single-column update, batch
of 1000). For the Innei dataset (~30k comments, ~200 owner replies) it
completes in well under a minute.

## `scripts/backfill-country.ts`

Resolves `country_code` from `ip` for rows where `country_code IS NULL AND ip
IS NOT NULL`. Reuses `CommentCountryService.lookupCountryCode` so the per-IP
Redis cache (30-day TTL) is populated as a side effect.

Rows whose IP fails to resolve (private IP, upstream timeout, unknown country)
are skipped — `country_code` stays NULL and the row will be retried on the
next run.

```sh
pnpm -C apps/core exec tsx scripts/backfill-country.ts --mode dry-run
pnpm -C apps/core exec tsx scripts/backfill-country.ts --mode apply
```

Expected runtime is dominated by upstream geoip latency. On a cold cache,
plan ~150ms per unique IP (freeipapi). On a warm cache, ~5s per 10k rows.
For the Innei dataset (~30k comments, ~6k unique IPs) it completes in 10–15
minutes cold, seconds warm.

## Order of execution

The two scripts are independent and can run in any order. The recommended
sequence after deploying PR1 is:

1. `backfill-owner-reply.ts --mode dry-run` → review counts
2. `backfill-owner-reply.ts --mode apply`
3. `backfill-country.ts --mode dry-run` → review counts
4. `backfill-country.ts --mode apply`

Both are safe to re-run; subsequent runs are cheap because the row sets are
empty.
