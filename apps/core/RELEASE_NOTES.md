## TL;DR

Companion devices can now publish an explicit, sanitized Moment snapshot directly into Recently without adding a new database model or migration.

## Changes

- Added the `POST /companion/recently` endpoint and the `companion:moment:write` device scope for explicit Moment publication.
- Stored Moment v1 data in the existing Recently metadata field, including frozen application, media, and playback context after source controls and privacy sanitization.
- Added immutable artwork URL support and API Client models for the new publication flow.
- Existing Companion pairings must be paired again before Moment publication so that the new scope is granted.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.15.1...v13.16.0
