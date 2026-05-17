## TL;DR

Introduces the `@mx-space/cli` (`mxs`) for terminal-driven content authoring via OIDC device auth; the `Authorization: Bearer` header is now reserved for sessions only.

## Highlights

This release wires a complete OIDC device-authorization flow into mx-core's Better Auth instance and ships its first end-user CLI. Owners can now run `mxs auth login` from any terminal, approve the device on the admin panel, and drive posts, notes, pages, categories, topics, and configuration through the REST API — useful for self-host automation and agent-driven authoring. A new `device_codes` table and an `assets/render/device.ejs` template back the verification page.

To make room for OIDC bearer tokens, the API-key plugin no longer falls back to the `Authorization: Bearer` header. The documented `x-api-key` header (and `?token=` query parameter as a last resort) continues to work for API keys. A bearer-narrowing e2e test guards the boundary, and the CLI itself supports both flows via `--api-key` / `MXS_API_KEY` for headless contexts.

Hot content queries (posts, notes, pages, aggregate) have been retuned for fewer round-trips and better index usage, with stricter failure semantics: aggregate-root requests now fail loudly when a dependency errors instead of returning partial state. Mixed schema migrations are kept transactional end-to-end so a failed step rolls back the rest of the batch.

## Changes

### Features
- New `@mx-space/cli` (`mxs`) shipped to npm in parallel; server adds the Better Auth `deviceAuthorization` plugin, a `/device` controller rendering an EJS verification page, and a `device_codes` table for the device flow. ([#2723](https://github.com/mx-space/core/issues/2723))
- Server now enables the Better Auth `bearer()` plugin so OIDC access tokens issued by the device flow work transparently on subsequent API calls.

### Other
- Hot content read paths (post / note / page / aggregate) are faster and more predictable; mixed schema migrations now keep all statements in one transaction. ([#2732](https://github.com/mx-space/core/issues/2732))

## Upgrade Notes

- Pre-deploy: run `pnpm -C apps/core run migrate` so the new `device_codes` table (`0012_device_codes_table.sql`) is in place before the app starts. The app boot guard refuses to start against an older schema.
- Make sure the sibling `assets/` checkout is up to date; the device verification page renders from `assets/render/device.ejs`. The repo's `assets/` checkout has already been pushed.
- If any integration was passing API keys via `Authorization: Bearer <api-key>`, switch it to `x-api-key: <api-key>`. The Bearer header is now reserved for session/OIDC tokens.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.7.1...v12.8.0
