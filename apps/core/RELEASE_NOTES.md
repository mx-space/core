## TL;DR

Translation list endpoints no longer drop current translations wrongly marked stale when their snapshot body was SQL-truncated.

## Changes

- List endpoints returning SQL-truncated translation snapshots (`left(text, n)`) no longer flag otherwise-current rows as stale: the freshness check now routes these through a DB-backed hash recheck, so list responses match the detail endpoint instead of silently dropping live translations ([d5f322b](https://github.com/mx-space/core/commit/d5f322b18eb5b91d662489c015f7fb6dbb495b9c))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.0...v13.11.1
