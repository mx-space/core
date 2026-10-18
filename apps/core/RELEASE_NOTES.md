## TL;DR

Adds encrypted backups with user-held recovery keys, strengthens credential storage, and improves safe restoration without requiring backup secrets in environment variables.

## Highlights

Backup encryption is now available in Settings → Storage → Backup. Your browser generates a recovery key, displays it once, and lets you copy or download it before enabling encryption. Core stores only the public key and encrypts each complete backup with a fresh data key. Restoring an encrypted backup prompts for the saved recovery key, with file import and retry support.

Credential protection now covers configuration writes and caches, API key disclosure, secret logging, and staged upgrades to authenticated encryption and hashed API keys. Existing formats remain readable during the rollout. Backup restoration validates encrypted archives before changing data, runs database replacement in a transaction, and retains support for historical ZIP backups. The bundled admin includes the new settings and restore dialogs.

## Changes

### Features

- Enable complete backup encryption in settings, save the recovery key once, and restore by pasting or importing it. Manual, scheduled, and S3 backups follow the same setting ([bf62622](https://github.com/mx-space/core/commit/bf62622f6b8bd47237eaabc7655904d1f4c0c93e)).
- Opt into authenticated credential encryption and hashed API keys after all replicas support the new formats, with a transactional migration for existing records ([bf62622](https://github.com/mx-space/core/commit/bf62622f6b8bd47237eaabc7655904d1f4c0c93e)).

### Bug Fixes

- Protect merged configuration secrets before storage and caching, hide existing API key values, remove secret logging, and propagate key revocation across WebSocket replicas ([bf62622](https://github.com/mx-space/core/commit/bf62622f6b8bd47237eaabc7655904d1f4c0c93e)).
- Reject invalid recovery keys before restore operations and roll back failed database replacement ([bf62622](https://github.com/mx-space/core/commit/bf62622f6b8bd47237eaabc7655904d1f4c0c93e)).

### Other

- Update bundled editor packages to `@haklex/*` 0.47.0 ([73afbe4](https://github.com/mx-space/core/commit/73afbe424)).

## Upgrade Notes

- Preserve your existing field-encryption key and `JWT_SECRET`. Editing sensitive configuration requires encryption enabled with an explicit 64-character hexadecimal `MX_ENCRYPT_KEY` or `ENCRYPT_KEY`.
- Leave `MX_SECRET_STORAGE_V2=false` during the initial rolling upgrade. After every replica runs this release, enable it everywhere with encryption configured and a stable `JWT_SECRET` of at least 32 characters. Then run the one-shot credential migration as described in the [rollout guide](https://github.com/mx-space/core/blob/v14.16.0/docs/security-secret-storage.md). Do not run this migration during the initial deployment or roll back to older readers afterwards.
- Upgrade all replicas and the bundled admin before enabling backup encryption. No backup environment variable is needed. Keep every recovery key separately from backups; losing it makes the corresponding encrypted archives unrecoverable. Existing archives are not rewritten, and recovered credentials still require their original field-encryption key and JWT secret.
- Archive encryption does not isolate live credentials from a compromised application host. Review the [security and recovery limits](https://github.com/mx-space/core/blob/v14.16.0/docs/security-secret-storage.md) before activation.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.15.3...v14.16.0
