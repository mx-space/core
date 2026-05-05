# @mx-space/mongo-pg-cli

One-shot **MongoDB → PostgreSQL** data migration CLI for upgrading [mx-space](https://github.com/mx-space/core) from v11 to v12.

The CLI is a single self-contained ES module bundle that ships every Drizzle migration SQL file alongside it. It reads a v11 mongo database, allocates Snowflake IDs, runs the v12 schema migrations, then loads every row into the target PostgreSQL — with a dry-run mode that validates references before writing anything.

## Install / Run

No install needed:

```bash
npx @mx-space/mongo-pg-cli@latest --mode dry-run
```

Or install once and reuse:

```bash
npm i -g @mx-space/mongo-pg-cli
mx-mongo-pg-migrate --mode apply
```

## Modes

| Mode | What it does |
|---|---|
| `--mode dry-run` (default) | Reads from Mongo, allocates Snowflake IDs, walks every reference. Writes nothing. Reports row counts and missing/orphan references. |
| `--mode apply` | Runs Drizzle schema migrations against the target PostgreSQL, then loads every collection. Idempotent — safe to re-run. |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/mx-space` | Source v11 MongoDB URI. `DB_CONNECTION_STRING` also accepted. |
| `PG_URL` | composed from `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD`/`PG_DATABASE` | Target PostgreSQL URI. `PG_CONNECTION_STRING` also accepted. |
| `PG_HOST` | `127.0.0.1` | |
| `PG_PORT` | `5432` | |
| `PG_USER` | `mx` | |
| `PG_PASSWORD` | `mx` | |
| `PG_DATABASE` | `mx_core` | |
| `SNOWFLAKE_WORKER_ID` | `900` | Worker id for migration-allocated rows. Reserve `900-999` so it never collides with running app instances. |
| `MIGRATIONS_DIR` | bundled `./migrations` next to `cli.mjs` | Override only if you want to point at a different Drizzle migrations folder. Normally unset. |

## Typical run

```bash
# 1. Dry-run to validate
MONGO_URI=mongodb://127.0.0.1:27017/mx-space \
PG_URL=postgres://mx:mx@127.0.0.1:5432/mx_core \
npx @mx-space/mongo-pg-cli@latest --mode dry-run

# 2. Apply when the dry-run report looks acceptable
MONGO_URI=mongodb://127.0.0.1:27017/mx-space \
PG_URL=postgres://mx:mx@127.0.0.1:5432/mx_core \
npx @mx-space/mongo-pg-cli@latest --mode apply
```

## Output

- `Rows allocated:` per-collection count read from MongoDB
- `Rows loaded:` per-collection count written into PostgreSQL
- `Missing refs:` orphan rows whose foreign id no longer resolves; usually safe to ignore but worth a glance
- `data_migration_runs` table records every apply run — review there if a previous run was interrupted
- `mongo_id_map` table holds the audit Mongo `_id` ⇄ Snowflake mapping for every collection

## Re-running

`apply` mode is **safe to re-run** — every insert uses `ON CONFLICT DO NOTHING`, and the persisted id map ensures resumed runs reuse the same Snowflake IDs. The CLI never writes back to MongoDB.

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `MongoServerSelectionError` | `MONGO_URI` host not reachable | Verify the host/port; if running inside docker, use the container name and ensure the network is shared |
| `connection refused` (PG) | `PG_URL` host not reachable | Same as above; check `pg_isready -h $host -p $port` |
| `Missing refs > 0` | Orphan documents in source mongo | Almost always safe — these are stale ids that never resolved historically |
| `relation "x" does not exist` during apply | `MIGRATIONS_DIR` points at the wrong place | Don't set it; the bundle ships its own migrations next to `cli.mjs` |

## License

AGPL-3.0
