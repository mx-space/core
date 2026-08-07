## TL;DR

Space gains a native iOS administration app and secure push delivery through a separately deployable relay.

## Highlights

**Administration from iPhone.** The native Space app now supports device-authorization pairing, dashboard statistics, comment review, quick note and say publishing, and file-library access. Mobile-specific API views provide the data needed by these workflows without requiring the full web administration interface, while the checked-in OpenAPI contract keeps the Swift packages and server routes aligned.

**Privacy-preserving push delivery.** mx-core can register devices and queue notification events through an independently deployed Push Relay. The relay receives only the minimum comment resource identifier instead of comment text, author details, email addresses, IP addresses, or user-agent data. Delivery credentials are encrypted at rest, and relay requests are limited to explicit server-controlled HTTPS origins.

**Repeatable TestFlight delivery.** The repository now includes a GitHub Actions workflow for signed iOS archives and TestFlight uploads. It runs automatically only when mobile-related files change, remains available for manual dispatch, and uses read-only repository permissions. This keeps routine server changes from consuming Apple build capacity while preserving an auditable release path for the mobile application.

## Changes

### Features

- Manage a Space instance from the native iOS application, including pairing, dashboard, moderation, publishing, and file workflows ([#2783](https://github.com/mx-space/core/pull/2783))
- Register mobile installations and deliver privacy-minimized comment notifications through the standalone Push Relay ([#2783](https://github.com/mx-space/core/pull/2783))
- Export and verify the mobile OpenAPI contract so server and Swift models remain synchronized ([#2783](https://github.com/mx-space/core/pull/2783))
- Build and upload signed iOS archives through a mobile-scoped or manually dispatched TestFlight workflow ([#2783](https://github.com/mx-space/core/pull/2783))

### Bug Fixes

- Reject untrusted or malformed Push Relay destinations before activation, deactivation, and event delivery ([#2783](https://github.com/mx-space/core/pull/2783))

## Upgrade Notes

- Existing deployments remain unaffected when push delivery is unused. To enable it, deploy and migrate the standalone Push Relay, enable mx-core encryption with a stable `MX_ENCRYPT_KEY`, and set `MX_PUSH_RELAY_ORIGINS` to the exact trusted HTTPS relay origins. The mx-core `0027_clean_vindicator` migration creates the new push source, binding, and delivery tables during the normal database migration process.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.21.0...v13.22.0
