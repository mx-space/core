# Local credential protection

Core protects recoverable credentials with authenticated encryption and stores API keys as hashes. This does not isolate the encryption key from a compromised application host; external KMS integration is a separate step.

## Required configuration

Field encryption is the only runtime mode in v18. Production builds require an explicit
64-character hexadecimal `MX_ENCRYPT_KEY` or `ENCRYPT_KEY`, and a stable
`JWT_SECRET` (alias `JWTSECRET`) of at least 32 characters. There is no
machine-ID fallback or short-key derivation. Keep existing effective secrets;
only an instance that has never encrypted data may generate its first random
field key with `openssl rand -hex 32`. Persist secrets before starting and
share the same values between app and migration services.

Source development startup may omit the field key. It creates a random hex64
key in `tmp/dev-encryption.key` relative to the working directory, with mode
`0600`, and reuses it across restarts and concurrent workers. An explicit
CLI/YAML/environment key always takes precedence. Preserve the local key with
the development database; an invalid local or explicit key fails instead of
being replaced. AES-256-GCM writes and the JWT requirements stay the same.
Release builds never use this fallback, even with `NODE_ENV=development`.
Standalone upgrade diagnostics still require the effective key in environment
configuration; copy the local key into the secret store when promoting a
development database to production.

Remove `ENCRYPT_ENABLE`, `MX_ENCRYPT_ENABLE` and `MX_SECRET_STORAGE_V2`.
Historical true values are accepted with a deprecation warning; false or
other unsupported values fail before business startup. These flags no longer
select a storage mode. Config/Snippet/Webhook writes always use authenticated
V2 encryption, API-key writes always hash, and OAuth writes stay encrypted.
Field writes use fixed AES-256-GCM with a fresh 96-bit nonce and a 128-bit
authentication tag. `ENCRYPT_ALGORITHM`, `--encrypt_algorithm` and YAML
`encrypt_algorithm` have been removed; supplying them fails even when set to
the old default or AES-256-GCM. Remove the option rather than changing its value.
The historical reader is fixed to the old default AES-256-ECB. Instances that
used another legacy algorithm must convert all affected credentials to V2 on
the prior version with their original algorithm and key before upgrading.
Keep those original settings with historical backups for isolated recovery.

The published v17.0.4 escape hatch is historical behavior, removed here.
The [upgrade guide](v18-preparation.md)
explains release migration, standalone check and maintenance JWT rotation. The tools can
inspect invalid settings without booting the application. Short JWT values
must be rotated with the original secret before starting this runtime; do not
replace their environment value alone.

Before persistent backfill, stop old-format writers on every replica and
background worker. `node migrate.mjs` (source: `pnpm -C apps/core migrate`)
performs the mandatory configuration, credential and AI-metric migrations.
The v18 credential migration has its own ledger ID, so an older opt-in
credential backfill cannot bypass it. There is no separate prepare command,
preparation marker or credential-migration activation flag. Run the read-only
check after migration, then start the new business replicas.

After conversion, roll back only to a tested reader of the new formats.
Neither disabling encryption nor switching back to old-format writes exists.
Preserve original field/JWT secrets and snapshots for recovery.

## Configuration migration before startup

The current-only config runtime requires the mandatory
`20261109-canonical-config` data migration via `node migrate.mjs` (source:
`pnpm -C apps/core migrate`). Stop all old replicas and background writers
before this contract migration. It converts old GitHub/membership/media and
nested SMTP options, encrypts credentials at their new AAD paths and removes
retired configuration rows. Invalid shapes, unreadable secrets and conflicting
credentials roll back the config batch and block deployment. No activation
flag is needed. Startup requires the migration ledger; configuration reads
and PATCH no longer convert legacy data. Retired sections/unknown fields fail
explicitly. Historical conversion remains in release/offline upgrade code.

## Storage and API behavior

- Sensitive configuration is encrypted **after merging**, before PostgreSQL and Redis writes. Blank secret fields retain the existing value. Responses sanitize stored objects without decrypting them, including when reading historical plaintext.
- The v2 envelope carries a format version, key fingerprint, random 96-bit nonce, authentication tag and ciphertext. AAD binds configuration secrets to their field paths and Snippet/Webhook secrets to their record and field. A wrong key, invalid context, corrupt envelope or encryption failure is an error; it is never a plaintext fallback. Legacy plaintext/ECB reads remain for explicit upgrades and historical recovery.
- API keys are displayed only in the creation response. List/detail responses contain only the visible prefix. `mx-hashed-v1` identifies hashed records, so a hash copied from the database cannot authenticate through the legacy verifier. The legacy reader is retained for upgrade compatibility; migrated records always use the hashed configuration. Revocation uses the key ID and closes associated WebSocket connections on every replica through the existing Redis bus.
- Password hashes, OAuth tokens, ID tokens and raw provider payloads are excluded from session profile responses.
- OAuth access/refresh token encryption uses `JWT_SECRET` as Better Auth key version 1. Encryption and authentication secrets must remain available for recovery of their respective data.

## Encrypted backups

Enable **Settings → Storage → Backup → Backup encryption**. The browser generates a recovery key and displays it once, with copy and download actions. Confirm that you have saved it, then save the settings. Canceling the dialog leaves encryption disabled. No backup environment variable is required; this setting is independent of mandatory field encryption. The browser must use HTTPS or localhost for Web Crypto.

Only the public key is sent to and stored by the server. The RSA-3072 private recovery key stays in the browser's temporary modal state until the user closes it; it is not put in application settings, browser storage or query caches. Every backup gets a fresh random AES-256-GCM data key, wrapped with RSA-OAEP-SHA256 and the configured public key. The versioned `.mxbackup` envelope includes the wrapped key, random 96-bit nonce and authentication tag; its header is authenticated. See the [Node crypto API](https://nodejs.org/api/crypto.html#cryptopublicencryptkey-buffer) for the platform primitives.

While enabled, manual backups, scheduled backups, safety snapshots, downloads and S3 uploads all use the encrypted archive, retaining the database and data files with stored credentials. An enabled configuration with a missing/invalid public key is rejected; it never silently creates a plaintext backup. When disabled, new backups are ordinary ZIP files. Existing archives are not rewritten by changing the setting.

To upload or roll back an encrypted backup, paste its private recovery key or import the saved `.pem` file in the restore dialog. It is sent only with the authenticated restore request and is not stored on the server. Restore authenticates the complete archive before extraction or database operations. Wrong/missing keys and damaged files are rejected. The dialog stays open after an error so the key can be corrected. Historical ZIPs need no key. Archives from the earlier symmetric format are readable by pasting their original 64-character hexadecimal key.

Restore requires the PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`). It rebuilds the omitted runtime tables (sessions, logs, search indexes) as empty tables, preserving their current schema. Database replacement runs in one transaction, so a SQL failure rolls it back. Data-directory files are copied afterwards and are not part of that database transaction; keep the safety snapshot if a file copy fails.

Keep recovery keys in a password manager or other separate location, along with the existing field-encryption key and `JWT_SECRET`: the latter two are still needed to use credentials stored inside the recovered database. Do not store recovery keys in the data directory or alongside backup files. Losing one makes its encrypted backups unrecoverable. Each activation generates a new key pair; older archives still need their original recovery key. Upgrade every replica and the admin UI before activating this feature; older releases cannot restore the new archive format.

Plaintext dumps and ZIPs are staged in a private temporary directory and removed on normal completion or errors. A host crash or forced process termination can leave that directory behind; protect the host's temporary storage and clean up stale `mx-backup-*` directories when no backup/restore job is running. Backups still fit in memory, and restore uploads keep the existing 100 MiB limit.

Historical backups and logs are not rewritten. Restrict their access and retention separately. If a credential or its old encryption key may already have escaped, rotate the external credential; re-encrypting the live database cannot revoke a copied secret. Storing only the public key prevents a copied server configuration from decrypting existing backups. A compromised runtime can still read live credentials and observe a recovery key while it is being used for a restore; archive encryption is not KMS/HSM isolation.
