## TL;DR

Repairs a schema migrator flaw that let a migration be recorded as applied without running, breaking article translations.

## Changes

- A migration whose journal timestamp is not strictly increasing is no longer mistaken for already-applied history and skipped without executing its SQL ([33d2a43](https://github.com/mx-space/core/commit/33d2a43dd727b9143169f17cc1034d4373bf68e8))
- Servers upgraded to v13.25.2 automatically regain the missing `ai_translations.updated_at` column on deploy, so post, note, and category listings return translated content again ([33d2a43](https://github.com/mx-space/core/commit/33d2a43dd727b9143169f17cc1034d4373bf68e8))
- The startup schema guard now verifies every bundled migration by hash rather than trusting the newest recorded timestamp, so an unapplied migration blocks the deploy instead of surfacing later as runtime query failures ([33d2a43](https://github.com/mx-space/core/commit/33d2a43dd727b9143169f17cc1034d4373bf68e8))
- Failed translation lookups now log the underlying database error instead of only the SQL statement that failed ([33d2a43](https://github.com/mx-space/core/commit/33d2a43dd727b9143169f17cc1034d4373bf68e8))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.25.2...v13.25.3
