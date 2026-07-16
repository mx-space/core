## TL;DR

This release introduces Companion Live Desk, secure device pairing, privacy-safe presence sharing, and an integrated administration experience.

## Highlights

- Pair Companion devices with short-lived codes and device-scoped credentials, then inspect or revoke each device from the administration interface.
- Publish sanitized, TTL-bound Live Desk presence through REST, WebSocket, and webhook transports, with explicit privacy filtering and capability flags.
- Preview the exact public availability, application, and window-title projection before enabling Live Desk, without exposing raw device credentials or bundle identifiers.

## Changes

### Features

- Added the Companion platform, including pairing lifecycle, device authentication, PostgreSQL persistence, presence projection and expiry, transport fan-out, feature policy, and migration support ([4cf2163](https://github.com/mx-space/core/commit/4cf2163064bb43298d59de3f8f87e5129b018a03))
- Added the Companion administration route with capability status, pairing-code generation, sanitized Live Desk preview, publishing controls, and device revocation ([4cf2163](https://github.com/mx-space/core/commit/4cf2163064bb43298d59de3f8f87e5129b018a03))
- Published typed Companion APIs in `@mx-space/api-client` 5.5.0 and the `companion.presence.changed` contract in `@mx-space/webhook` 0.9.0 ([df5d2ae](https://github.com/mx-space/core/commit/df5d2aef4), [908cf8d](https://github.com/mx-space/core/commit/908cf8d41))
- Added the generic administration resource-collection data layer for posts and categories ([3dadadc](https://github.com/mx-space/core/commit/3dadadc62))
- Updated the rich-text stack to `@haklex/*` 0.31.0 and refreshed workspace dependencies ([8b6e8c3](https://github.com/mx-space/core/commit/8b6e8c3b9))

### Fixes

- Externalized third-party declaration dependencies so API Client builds remain stable with Rolldown 1.2 ([2b8879b](https://github.com/mx-space/core/commit/2b8879b48))
- Reconciled administration comment reply state after mutations ([887dbb9](https://github.com/mx-space/core/commit/887dbb99f))
- Made API Client and Webhook release validation self-contained and directly runnable from each package ([a2e99f3](https://github.com/mx-space/core/commit/a2e99f341))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.12.0...v13.13.0
