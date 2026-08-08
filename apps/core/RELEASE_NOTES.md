## TL;DR

Fixes TTS narration staleness detection after re-translation, and compiles Zod validation schemas ahead of time for lower request overhead.

## Changes

### Bug Fixes

- AI narrations voiced from a translated article are now correctly flagged as stale when the translation is regenerated or hand-edited without touching the original article — readers see the "content edited" hint instead of silently hearing outdated audio ([dbcbb21](https://github.com/mx-space/core/commit/dbcbb21d8357fcba52ea109645f65959623c7a80))

### Other

- Request-validation Zod schemas are now compiled at build time instead of per process, reducing validation overhead on every request ([6f40b9a](https://github.com/mx-space/core/commit/6f40b9a77e37902082d3c19079e6b20377de9fe5))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.25.1...v13.25.2
