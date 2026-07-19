## TL;DR

Membership payment configuration now provides reusable provider credentials, guided setup instructions, and automatic migration from existing Dodo-specific settings.

## Changes

- Added a guided Membership configuration interface covering provider selection, environment, subscription products, webhook endpoint, required events, and signing credentials.
- Generalised payment-provider configuration keys while preserving existing Dodo credentials through automatic read-time migration.
- Added a secret-safe configuration status endpoint so the administration interface can report setup readiness without exposing stored credentials.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.15.0...v13.15.1
