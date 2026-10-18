# Push Relay

Single-instance APNs relay backed by one SQLite file. No PostgreSQL or Redis
service is needed. SQLite is bundled into the binary; database operations run
on a dedicated thread, with foreign keys enabled and WAL journaling.

## Run locally

```sh
export PUSH_RELAY_DATABASE_PATH=./push-relay.sqlite3
export PUSH_RELAY_PUBLIC_URL=http://localhost:8787
export PUSH_RELAY_DATA_KEY="$(openssl rand -hex 32)"
export PUSH_RELAY_APPS_JSON='[{"id":"space","bundleId":"your.bundle.id","teamId":"YOUR_TEAM","keyId":"YOUR_KEY","privateKeyPath":"/path/to/AuthKey.p8"}]'
cargo run --release -- migrate
cargo run --release
```

`PUSH_RELAY_PORT` defaults to `8787`; `PUSH_RELAY_DATABASE_PATH` defaults to
`./push-relay.sqlite3`. Keep the data key stable: existing device tokens and
source credentials cannot be decrypted after changing it.

## Deploy

Build from the repository root:

```sh
docker build -f apps/push-relay-rs/Dockerfile -t push-relay .
docker run --rm -p 8787:8787 --env-file relay.env \
  --mount type=volume,src=push-relay-data,dst=/data \
  --mount type=bind,src=/path/to/keys,dst=/keys,readonly push-relay
```

Put the public URL, data key, and APNs app configuration in `relay.env`. APNs key
paths must point to readable files under `/keys`. The image defaults to
`/data/push-relay.sqlite3` and runs migrations before starting the relay. The
process runs as `nobody`; bind-mounted data directories must be writable by that
user (UID 65534). Preserve the entire `/data` directory across container updates.

The Railway configuration in `/.railway/railway.ts` attaches a `/data` volume,
uses one replica, and runs migrations in the start command because pre-deploy
containers cannot access the volume. Its root setup step gives `nobody` access
to the volume and APNs key files, then drops privileges before running the relay.

Run only one relay process per database file. Pending and scheduled retries
survive restarts; interrupted `processing` deliveries are requeued on startup.
Delivery remains at least once: a crash after APNs accepts a message but before
the result is saved may cause that notification to be sent again.

## Upgrading from PostgreSQL

SQLite migrations initialize a new SQLite database. To preserve devices,
credentials, bindings, notification preferences, tickets, events, and delivery
state, use the offline importer (Python 3 and the `psql` client are needed only
for this one-time operation):

1. Back up PostgreSQL and stop the old relay. Keep `PUSH_RELAY_DATA_KEY` unchanged.
2. Initialize an empty SQLite file and import a consistent, read-only PG snapshot:

   ```sh
   export PUSH_RELAY_DATABASE_PATH=/path/to/push-relay.sqlite3
   push-relay migrate
   # Set PUSH_RELAY_DATABASE_URL to the old PostgreSQL connection URL.
   python3 scripts/import-postgres.py "$PUSH_RELAY_DATABASE_PATH"
   ```

3. Put the imported file on the persistent volume and start the new relay with
   the same data key. Remove `PUSH_RELAY_DATABASE_URL` from the relay environment;
   the running relay only uses `PUSH_RELAY_DATABASE_PATH`.

The importer refuses a nonempty destination and rolls back the whole import on
failure. It leaves PostgreSQL unchanged and preserves timestamps, delivery
attempts, and scheduled retry times. Interrupted `processing` deliveries are
requeued when the new relay starts. Do not delete PostgreSQL until the cutover
is verified. Starting with an empty file instead requires devices to activate again.

Back up SQLite with its backup API (for example, `sqlite3 DATABASE '.backup BACKUP'`)
or stop the relay before copying its database files. Do not copy only the main
database file while the relay is writing to its WAL.
