# v18 preparation (unreleased)

This is the v17 preparation phase. v18 enforcement, SDK 6 cleanup and column
removal remain future work. These commands are not part of released v17.0.4.
No minimum released preparation tag is established yet. Build and deploy this
preparation code to every replica before using it; do not publish or migrate
production as part of reviewing this branch.

## Preconditions and checks

Save database/files snapshots, the original field key, original JWT, and any
archive recovery private key. Never replace existing secrets with newly
generated ones to resolve a decryption error. Older instances complete their
historical schema/data migrations before using this runner.

The independent CLI consumes environment configuration, not the application's
CLI/YAML flags. Supply the same effective `PG_URL` (preferred),
`PG_CONNECTION_STRING` or `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD`/`PG_DATABASE`,
optional `PG_SSL`, `MX_ENCRYPT_KEY`/`ENCRYPT_KEY`, enable flag,
`JWT_SECRET`/`JWTSECRET`, and `MX_SECRET_STORAGE_V2`. `.env` is loaded relative
to the command's working directory. It does not start HTTP, business services,
background jobs or Redis. Migrate the schema separately first.

```sh
pnpm -C apps/core upgrade:check --json
```

`check` is read-only: exit 0 means ready, 2 means needs-action, and 1 means
inspection failed. Reports contain counts, record paths and stable codes,
never secret values. Missing/bad encryption settings and short JWT values do
not prevent diagnostics. Empty installations do not need a historical marker.
Existing installations require a new marker plus current data verification;
an old secret-migration ledger row alone is insufficient.

## Short JWT maintenance

Stop all application replicas, background jobs and other business writers.
Read the old JWT from the existing secret store into a protected secret file;
generate and save a distinct new JWT of at least 32 characters in another.
The command takes file paths only and never rewrites either file:

```sh
pnpm -C apps/core upgrade:rotate-jwt --maintenance-confirmed --old-jwt-file /secure/old-jwt --new-jwt-file /secure/new-jwt
```

OAuth access/refresh tokens (plaintext, legacy Better Auth bare hex or versioned
envelopes) are unwrapped with the old secret and rewrapped with the new secret
in one transaction. A suspicious encrypted format or wrong old secret fails
without plaintext fallback. The batch rolls back on any failure, including
session invalidation. Provider tokens, field keys and API-key strings remain.
No provider calls occur. Successful rotation clears login sessions: everyone
must sign in again. The operator then applies the same new JWT to every
replica before starting them. Missing original JWT plus encrypted tokens
requires recovering the original secret or reauthorizing the account.

## Explicit preparation

After every replica has the compatible reader, enable field encryption and
V2 writes everywhere. Confirm no old writer remains. A short JWT must be
rotated before enabling V2. Use the original field key; only an instance that
has never encrypted data may generate its first random key.

```sh
pnpm -C apps/core upgrade:prepare --all-replicas-v2 --dry-run
pnpm -C apps/core upgrade:prepare --all-replicas-v2
pnpm -C apps/core upgrade:check --json
```

`--all-replicas-v2` is an operator attestation, not automatic cluster discovery.
Preparation holds a PostgreSQL advisory lock shared by configuration PATCH.
It decrypts secrets at their old AAD paths, converts legacy AI/media, GitHub
and membership options to canonical storage, encrypts at new paths, hashes
API keys once, protects OAuth, and fills missing AI metrics. Existing client
API-key strings continue to verify. It writes the new marker only after no
residuals remain. Malformed data or wrong secrets roll the whole transaction
back. Unknown fields retained by v17 are not made strict in this phase.

Dry-run executes and rolls back the complete transaction. `would-be-ready`
does not mean a marker was persisted. Repeated successful preparation is
idempotent and does not rehash keys or rotate tokens. After a real commit,
restart business replicas to retire old caches, then check original API-key
authentication, OAuth, configuration consumption and AI metadata. Do not flush
all Redis state.

A blank canonical credential falls back to a populated legacy credential.
Different nonempty old/new values report `CONFIG_SECRET_CONFLICT` with the
field path and stop preparation. Reads stay compatible; to resolve the
conflict, explicitly save the intended canonical credential in settings,
then run check again. An unrelated partial save of that section is rejected
so it cannot silently delete the other secret.

## Built artifacts and containers

Run `node upgrade.mjs check --json`, `node upgrade.mjs prepare` or
`node upgrade.mjs rotate-jwt` with the same arguments in the built output.
Docker copies this entry and its shared chunks with the main application.
A future preparation image can run the tool without starting app services:

```sh
docker compose run --rm --no-deps app node upgrade.mjs check --json
```

The database must already be running. For JWT rotation mount both secret files
read-only and pass their in-container paths. Ensure the app replicas are
stopped; `--no-deps` by itself does not stop an existing replica. Keep app and
migration images pinned to the same verified release, not an unreviewed latest.

## Compatibility and recovery

The prepared runtime no longer selects/inserts/updates/returns the retired
AI metadata columns; the migration schema still retains them. v17 response
fields derive from metrics. The columns may be removed only in a later
release after every replica runs this code. Fresh AI generation metadata must
continue to use the metrics ledger.

Old GET maintenance routes coexist with the new POST routes. Compatible SDK
5.x code uses POST for attitudes, string sorting and header authentication;
public signatures remain. Admin uses POST for backup creation, cache clearing
and test mail. SDK/CLI/theme minimum published versions are not yet verified;
do not advertise an unsupported v18 compatibility matrix.

Rollback code only to an actually tested preparation build. The minimum
published tag remains unset. Code rollback does not reverse schema/data.
Older versions require their old complete snapshot and secrets.

The restore service does not currently provide automatic v18 isolation or
preflight. Restore historical ZIP/v1 encrypted archives into an isolated
preparation installation using original archive/field/JWT secrets, run schema
migration and check/prepare, verify credentials and files, and only then plan
a v18 switch. Keep a pre-restore snapshot. Database replacement is atomic,
file copying is separate; failures must not be reported as a complete restore.
