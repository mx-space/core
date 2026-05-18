## TL;DR

Spider guard is reworked with a UA-first fast path and proper credential validation, eliminating per-request DB lookups for legitimate traffic.

## Highlights

The anti-scraper guard now runs the User-Agent check first as a cheap fast path. Browsers, RSS readers, search bots, and the `mxs` CLI flow through without touching the database. Only requests with missing or scraper-like UAs fall back to credential validation, which means production traffic gets faster and the auth subsystem sees less pressure.

Authenticated bypass is now correctly enforced. Previously, any request carrying an `Authorization` or `x-api-key` header would slip past the UA filter without the credentials actually being validated — a bare `Authorization: junk` was enough. The guard now injects `AuthService` (via `APP_GUARD`) and only honors the bypass when the session or owner-scoped API key resolves. Operators with an authenticated client (CMS, mxs CLI, custom integrations) will see no change; abusive scrapers spoofing the header will not.

## Changes

### Features
- Spider guard now uses a UA-first fast path with `AuthService`-backed credential validation; legitimate browsers, RSS readers, and bots bypass without DB lookups. ([28cb17d](https://github.com/mx-space/core/commit/28cb17d5c99c40457f9e727812c9415df59770d0))

### Bug Fixes
- Spider guard properly validates `Authorization` and `x-api-key` credentials before bypassing the UA filter, closing a header-spoofing gap. ([c4ab9c5](https://github.com/mx-space/core/commit/c4ab9c584fc79254fc0eb76be917c5871cc1b508))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v12.8.0...v12.9.0
