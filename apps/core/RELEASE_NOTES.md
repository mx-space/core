## TL;DR

The admin dashboard is now built into the server from source — no external download — alongside reader bans and URL-based enrichment in the SDK.

## Highlights

The admin dashboard (formerly the separate `mx-admin` repo) now lives in this monorepo and is compiled from source as part of the server build. A release bundles the freshly built dashboard into `out/admin`, so a server install no longer downloads a prebuilt dashboard zip from GitHub. The dashboard is also published to a Cloudflare R2 update channel for future in-place upgrades. No operator action is required — it is served at the same `/proxy/qaqdmin` path as before.

Readers can now be banned, and the readers API supports role-filtered pagination, making moderation of a growing audience practical. Reader replies on comments now stay marked unread instead of inheriting the parent's read state, so fresh replies surface correctly.

The typed API client gained an `EnrichmentController` with `resolveByUrl`, exposing the server's URL enrichment (Open Graph / metadata) to frontends through the SDK.

## Changes

### Features
- Admin dashboard is built into the server from source and bundled at release time; also published to a Cloudflare R2 update channel for future upgrades. ([#2740](https://github.com/mx-space/core/pull/2740))
- Reader management: ban support and role-filtered pagination. ([91acc5d](https://github.com/mx-space/core/commit/91acc5d3))
- api-client: add `EnrichmentController` with `resolveByUrl`. ([7557134](https://github.com/mx-space/core/commit/7557134d))

### Bug Fixes
- Reader replies stay unread instead of inheriting the parent comment's read state. ([7332443](https://github.com/mx-space/core/commit/73324431))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.2.0...v13.3.0
