## TL;DR

Existing webhook subscriptions are restored after event renaming, and content notifications now arrive without requiring a summary.

## Changes

- Migrate legacy webhook subscription names to the current event names, restoring deliveries after upgrades ([66621d9](https://github.com/mx-space/core/commit/66621d94b5a71a064523a2f20c8aa768f1fd25ae))
- Send post, note, and thinking notifications when no summary exists, while preserving title and content-type context ([3b912ea](https://github.com/mx-space/core/commit/3b912ea20c59f79c42d3ee47e8b3c31e89ec9a98))
- Update remaining user-facing and API references from MX Space to Mix Space ([d95d9c4](https://github.com/mx-space/core/commit/d95d9c48848b618af100438d91a25de20ea64680))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.4.0...v14.4.1
