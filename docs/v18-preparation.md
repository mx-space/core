# v18 preparation (unreleased)

This unreleased branch now requires field encryption, an explicit hex64 key
and a JWT of at least 32 characters. Plaintext/ECB writes, encryption-disable
flags and machine-ID fallback have been removed. Canonical configuration migration and strict configuration PATCH validation
are also enforced here. SDK 6 cleanup and column removal remain future work. These commands are not part of released v17.0.4.
No minimum released preparation tag is established yet. Obtain this build
without starting business replicas; do not publish or migrate production as
part of reviewing this branch.

## Preconditions and checks

Save database/files snapshots, the original field key, original JWT, and any
archive recovery private key. Never replace existing secrets with newly
generated ones to resolve a decryption error. Older instances complete their
historical schema/data migrations before using this runner.

The independent CLI consumes environment configuration, not the application's
CLI/YAML flags. Supply the same effective `PG_URL` (preferred),
`PG_CONNECTION_STRING` or `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD`/`PG_DATABASE`,
optional `PG_SSL`, `MX_ENCRYPT_KEY`/`ENCRYPT_KEY`, and
`JWT_SECRET`/`JWTSECRET`. Remove the old encryption/V2 flags; explicit false
values are diagnosed as `DEPRECATED_ENCRYPTION_FLAG`. `.env` is loaded relative
to the command's working directory. It does not start HTTP, business services,
background jobs or Redis. Migrate the schema separately first.

```sh
pnpm -C apps/core upgrade:check --json
```

`check` is read-only: exit 0 means ready, 2 means needs-action, and 1 means
inspection failed. Reports contain counts, record paths and stable codes,
never secret values. Missing/bad encryption settings and short JWT values do
not prevent diagnostics. Empty installations do not need a historical marker.
Existing installations require the canonical configuration migration record
and current data verification. There is no separate preparation marker;
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

## Release migration

Obtain this build without starting business replicas. Run check and rotate a
short JWT during maintenance first. Stop every old replica/background writer,
remove old encryption flags and use the persisted field/JWT secrets. Run
`node migrate.mjs` (source: `pnpm -C apps/core migrate`) before startup. The
mandatory `20261109-canonical-config` app-data migration converts old config
rows atomically, rebinds secrets to new paths, deletes retired rows and then
records completion. No activation flag is needed. This contract step requires
a maintenance cutover: old versions must not write afterwards.

The current runtime has no config conversion or synthetic media sections.
Retired section reads/writes fail with CONFIG_NOT_FOUND; old/unknown declared
fields fail with CONFIG_VALIDATION_FAILED. Partial updates, blank secret
retention and freeform record keys remain supported. Startup refuses to load
configuration without the migration record. Historical conversion lives only
in release/offline upgrade code, including nested legacy SMTP options.

The same release runner backfills AI metrics and always runs the v18
`20261109-required-secret-storage` migration. It protects Snippet/Webhook
secrets, hashes API keys and encrypts OAuth tokens. This uses a new migration
ID so a historical opt-in credential migration cannot skip the v18 backfill.
No activation flag or separate preparation command is required.

```sh
pnpm -C apps/core migrate
pnpm -C apps/core upgrade:check --json
```

Configuration conversion holds the database lock shared by configuration
PATCH. Each migration records completion only after success; a failed batch
rolls back and blocks deployment. Earlier successful migrations retain their
ledger records and are skipped on retry. Existing API-key strings continue to
verify; rerunning migrations does not rehash keys or rotate existing tokens.
There is no independent prepare, preparation marker or dry-run command.

After migration and a successful check, start new business replicas and verify
original API-key authentication, OAuth, configuration consumption and AI
metadata. Do not flush all Redis state.

A blank canonical credential falls back to a populated legacy credential.
Different nonempty old/new values report CONFIG_SECRET_CONFLICT and roll back
the configuration batch. Resolve the values in the old installation or an
isolated maintenance environment, then rerun; the new runtime cannot repair
old shapes via PATCH. Never overwrite a lost key with a newly generated key.

## Built artifacts and containers

Run `node migrate.mjs` for the release migration, `node upgrade.mjs check --json`
for diagnostics or `node upgrade.mjs rotate-jwt` for maintenance rotation.
Docker copies this entry and its shared chunks with the main application.
A future preparation image can run the tool without starting app services:

```sh
docker compose run --rm --no-deps app node upgrade.mjs check --json
```

The database must already be running. Compose requires nonempty persisted
field/JWT values before launching any service. Use the source CLI or a direct
`docker run` invocation to diagnose missing settings without Compose validation.
For JWT rotation mount both secret files
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
maintenance installation using original archive/field/JWT secrets, run the
release migration and check, verify credentials and files, and only then plan
a v18 switch. Keep a pre-restore snapshot. Database replacement is atomic,
file copying is separate; failures must not be reported as a complete restore.
