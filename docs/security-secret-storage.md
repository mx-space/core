# Local credential protection

Core protects recoverable credentials with authenticated encryption and stores API keys as hashes. This does not isolate the encryption key from a compromised application host; external KMS integration is a separate step.

## Rollout

This is an expand-before-contract rollout. Two replicas may overlap, so the new reader ships before new writes.

1. Configure an explicit random 32-byte encryption key as 64 hexadecimal characters (`MX_ENCRYPT_KEY` or `ENCRYPT_KEY`) and a stable `JWT_SECRET`. Keep the existing keys when upgrading an installed instance. Machine identity is not an encryption secret. Writes of non-empty sensitive configuration require encryption to be enabled.
2. Deploy this version to **every replica** with `MX_SECRET_STORAGE_V2=false` (the default). This immediately fixes configuration plaintext writes, removes secret logging, and masks token details. Config and Snippet writes retain the legacy cipher format during this phase. Webhook and OAuth writes retain their old format so the preceding release can still read them.
3. After every replica has the compatible reader, deploy `MX_SECRET_STORAGE_V2=true` to every replica. New configuration/Snippet secrets use AES-256-GCM; Webhook credentials are encrypted; API keys use Better Auth hashes; OAuth access/refresh tokens use Better Auth authenticated encryption. All replicas must finish this step before the backfill, so no legacy writer can reintroduce plaintext afterwards.
4. Run the one-shot data migration using the same database, encryption key and JWT secret as the application:

   ```sh
   pnpm -C apps/core run migrate:secrets
   ```

   In the release container, the equivalent is to set `MX_SECRET_STORAGE_V2=true` and `MX_MIGRATE_SECRETS=1` for a one-shot `node migrate.mjs` invocation. Do not put `MX_MIGRATE_SECRETS` in the regular app environment. The migration is explicitly opt-in, transactional and repeatable; the standard app-migration ledger records completion. It does not change schema or contact credential providers.

5. Refresh running instances after the backfill so old cached representations retire. Verify configuration consumption, API authentication and token revocation. Existing client API key strings remain valid after hashing.

After activation, rollback only to a version that understands the new formats. Do not roll back to the preceding release or disable v2 writes again. Do not change encryption/JWT keys as part of this rollout. Key IDs identify the required encryption key; they do not provide automatic key rotation or recovery.

## Storage and API behavior

- Sensitive configuration is encrypted **after merging**, before PostgreSQL and Redis writes. Blank secret fields retain the existing value. Responses sanitize stored objects without decrypting them.
- The v2 envelope carries a format version, key fingerprint, random 96-bit nonce, authentication tag and ciphertext. AAD binds configuration secrets to their field paths and Snippet/Webhook secrets to their record and field. A wrong key, invalid context, corrupt envelope or encryption failure is an error; it is never a plaintext fallback. Legacy plaintext/ECB reads remain for the staged upgrade.
- API keys are displayed only in the creation response. List/detail responses contain only the visible prefix. `mx-hashed-v1` identifies hashed records, so a hash copied from the database cannot authenticate through the legacy verifier. The legacy reader is retained for upgrade compatibility; migrated records always use the hashed configuration. Revocation uses the key ID and closes associated WebSocket connections on every replica through the existing Redis bus.
- Password hashes, OAuth tokens, ID tokens and raw provider payloads are excluded from session profile responses.
- OAuth access/refresh token encryption uses `JWT_SECRET` as Better Auth key version 1. Encryption and authentication secrets must remain available for recovery of their respective data.

## Encrypted backups

Enable **Settings → Storage → Backup → Backup encryption**. The browser generates a recovery key and displays it once, with copy and download actions. Confirm that you have saved it, then save the settings. Canceling the dialog leaves encryption disabled. No backup environment variable is required; this setting is independent of `MX_SECRET_STORAGE_V2` and field encryption. The browser must use HTTPS or localhost for Web Crypto.

Only the public key is sent to and stored by the server. The RSA-3072 private recovery key stays in the browser's temporary modal state until the user closes it; it is not put in application settings, browser storage or query caches. Every backup gets a fresh random AES-256-GCM data key, wrapped with RSA-OAEP-SHA256 and the configured public key. The versioned `.mxbackup` envelope includes the wrapped key, random 96-bit nonce and authentication tag; its header is authenticated. See the [Node crypto API](https://nodejs.org/api/crypto.html#cryptopublicencryptkey-buffer) for the platform primitives.

While enabled, manual backups, scheduled backups, safety snapshots, downloads and S3 uploads all use the encrypted archive, retaining the database and data files with stored credentials. An enabled configuration with a missing/invalid public key is rejected; it never silently creates a plaintext backup. When disabled, new backups are ordinary ZIP files. Existing archives are not rewritten by changing the setting.

To upload or roll back an encrypted backup, paste its private recovery key or import the saved `.pem` file in the restore dialog. It is sent only with the authenticated restore request and is not stored on the server. Restore authenticates the complete archive before extraction or database operations. Wrong/missing keys and damaged files are rejected. The dialog stays open after an error so the key can be corrected. Historical ZIPs need no key. Archives from the earlier symmetric format are readable by pasting their original 64-character hexadecimal key.

Restore requires the PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`). It rebuilds the omitted runtime tables (sessions, logs, search indexes) as empty tables, preserving their current schema. Database replacement runs in one transaction, so a SQL failure rolls it back. Data-directory files are copied afterwards and are not part of that database transaction; keep the safety snapshot if a file copy fails.

Keep recovery keys in a password manager or other separate location, along with the existing field-encryption key and `JWT_SECRET`: the latter two are still needed to use credentials stored inside the recovered database. Do not store recovery keys in the data directory or alongside backup files. Losing one makes its encrypted backups unrecoverable. Each activation generates a new key pair; older archives still need their original recovery key. Upgrade every replica and the admin UI before activating this feature; older releases cannot restore the new archive format.

Plaintext dumps and ZIPs are staged in a private temporary directory and removed on normal completion or errors. A host crash or forced process termination can leave that directory behind; protect the host's temporary storage and clean up stale `mx-backup-*` directories when no backup/restore job is running. Backups still fit in memory, and restore uploads keep the existing 100 MiB limit.

Historical backups and logs are not rewritten. Restrict their access and retention separately. If a credential or its old encryption key may already have escaped, rotate the external credential; re-encrypting the live database cannot revoke a copied secret. Storing only the public key prevents a copied server configuration from decrypting existing backups. A compromised runtime can still read live credentials and observe a recovery key while it is being used for a restore; archive encryption is not KMS/HSM isolation.
