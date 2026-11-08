## TL;DR

Restores startup and configuration updates for existing installations with encryption disabled, while preserving strict checks for encrypted data and v2 storage.

## Changes

- Existing installations using `ENCRYPT_ENABLE=false` (or `MX_ENCRYPT_ENABLE=false`) with `MX_SECRET_STORAGE_V2=false` can start and save sensitive configuration again through legacy plaintext storage. API responses continue to mask sensitive configuration fields; existing ciphertext and v2 storage still require encryption and a valid key. ([c34c664](https://github.com/mx-space/core/commit/c34c66450af33652cedcbd198edc640aad1b3e91))
- Startup now warns that **v18 will require field encryption and an explicit 64-character hexadecimal key**. Keep existing encryption keys when upgrading and follow the [rollout guide](https://github.com/mx-space/core/blob/v17.0.4/docs/security-secret-storage.md). ([c34c664](https://github.com/mx-space/core/commit/c34c66450af33652cedcbd198edc640aad1b3e91))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.0.3...v17.0.4
