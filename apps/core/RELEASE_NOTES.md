## TL;DR

Core v18 makes field encryption mandatory, fixes credential storage to one protected format, and converts legacy configuration once during the release migration.

> v18.0.0 was tagged but never published: its release pipeline stopped before any image was pushed. v18.0.1 is the first available v18 build.

## Breaking Changes

- **Field encryption**: every production instance must provide an explicit 64-character hexadecimal `MX_ENCRYPT_KEY` or `ENCRYPT_KEY`; the machine-ID fallback and the option to run unencrypted are gone. **Migration**: keep your existing key and set it explicitly. Only an instance that never encrypted data generates a first key with `openssl rand -hex 32`. Remove `ENCRYPT_ENABLE=false` and `MX_SECRET_STORAGE_V2=false`; a `true` value is accepted with a warning.
- **JWT secret length**: `JWT_SECRET` must be at least 32 characters. **Migration**: do not just change the environment value. Stop every replica, generate a new secret (`openssl rand -hex 32 > new-jwt`), run `upgrade:rotate-jwt --maintenance-confirmed --old-jwt-file <path> --new-jwt-file <path>`, then start with the new secret. OAuth tokens are re-wrapped and all sessions end, so everyone signs in again.
- **Encryption algorithm option**: `ENCRYPT_ALGORITHM`, `--encrypt_algorithm` and YAML `encrypt_algorithm` are rejected, even with the old default. **Migration**: delete the option. Instances that used a non-default legacy algorithm must convert their credentials to V2 on v17.1.0 first.
- **Configuration storage**: the runtime reads only the current configuration schema and no longer converts old shapes on the fly. **Migration**: stop all old replicas and background writers, then run `node migrate.mjs` (source: `pnpm -C apps/core migrate`) before starting v18. This step needs a maintenance window, not a rolling deploy.
- **Configuration writes**: a PATCH carrying an unknown declared field returns `CONFIG_VALIDATION_FAILED` instead of being silently ignored. **Migration**: update scripts and clients that send whole configuration objects back, including masked or retired fields.

## Highlights

Credentials now have a single storage contract. Configuration, Snippet and Webhook secrets are written with AES-256-GCM, API keys are stored as hashes, and OAuth tokens are encrypted. The release migration converts existing plaintext and legacy ciphertext in place, and original API key strings keep working for clients.

Legacy configuration is converted once instead of on every start. Old AI, image generation, TTS, third-party and membership settings move into the current structure with their secrets re-bound to the new paths. Fields that no schema declares any more are removed and listed by path in the migration log.

Upgrades fail safely. A wrong key, damaged ciphertext or unsupported shape rolls the whole batch back and blocks the deploy, and re-running the migration after a success changes nothing. `upgrade:check` reports what an installation still needs without starting the application.

## Changes

### Features

- Configuration is migrated in the release phase and the runtime no longer carries legacy conversion ([e8c5f90](https://github.com/mx-space/core/commit/e8c5f90739ff1fdc23fd0a7fb980801a506305ba), [dab2ce7](https://github.com/mx-space/core/commit/dab2ce76fed58609dca42e497585fe52d145b9da))
- Encryption algorithm selection is removed; writes are always AES-256-GCM ([2abd543](https://github.com/mx-space/core/commit/2abd54359c6d1529e1b3bc606a39ef54e2518264))
- Source development can start without a field key: a local key is generated and kept in `tmp/dev-encryption.key` ([efa0c87](https://github.com/mx-space/core/commit/efa0c8783f43a6b255a8329ab04ee904dbdb3fd0))

### Bug Fixes

- Encrypted storage is required and legacy plaintext and ECB writers are retired ([0e6c51d](https://github.com/mx-space/core/commit/0e6c51db1f1701fe27b3378e1daea4b62b1019a0))
- Historical OAuth ciphertext is unwrapped before it is re-encrypted, so tokens are not double wrapped ([32c58bc](https://github.com/mx-space/core/commit/32c58bcdb4936993478b35e207e25825517d2329))
- Migration keeps raw configuration and sibling credentials intact when converting a section ([373da58](https://github.com/mx-space/core/commit/373da58c0c70e14ddfc743f01748defc9646e370))
- Installations with leftover fields from older versions can migrate; those fields are dropped and logged ([a6df268](https://github.com/mx-space/core/commit/a6df268e9085e05f3a52569ad06ccd0f952fa9cd))
- Docker Compose starts with either `MX_ENCRYPT_KEY` or `ENCRYPT_KEY` on older Compose releases ([3857035](https://github.com/mx-space/core/commit/385703537c30190fccc6c28b63fc2c32e2c5883e))
- Admin settings keep the schema's field casing when saving ([1d6f22b](https://github.com/mx-space/core/commit/1d6f22baa2baa29b3c54beb57fa65c82302d772c))

## Upgrade Notes

1. Upgrade from v17.1.0. Older versions complete their own migrations first.
2. Save a database snapshot, the original field key and the original JWT secret.
3. Run `upgrade:check --json` against the installation and resolve what it reports.
4. If the JWT secret is shorter than 32 characters, rotate it as described above.
5. Stop all old replicas, run the migration, run `upgrade:check` again, then start v18.

Running `upgrade:prepare` on v17.1.0 beforehand is optional. Legacy GET maintenance routes and SDK 5.x signatures still work in this release. Full guide: [docs/v18-preparation.md](https://github.com/mx-space/core/blob/v18.0.1/docs/v18-preparation.md).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v17.1.0...v18.0.1
