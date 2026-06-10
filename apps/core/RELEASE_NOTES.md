## TL;DR

Projects gain a full write API with proper conflict handling, and the bundled admin dashboard fixes update checks, agent diff rendering, and stale-chunk crashes.

## Highlights

The Project API is now fully manageable from the outside: a typed `PATCH /projects/:id` route lands alongside the existing PUT, with Zod-validated create/patch DTOs. Duplicate project names now return a clean `PROJECT_NAME_TAKEN` 409 instead of a raw database error, and get/patch/delete return `PROJECT_NOT_FOUND` when the row is missing. This backs the new `mxs project` command group in @mx-space/cli (list/get/view/create/edit/update/delete), released separately on npm.

The bundled admin dashboard catches up with the monorepo era. Update checks now look at `mx-space/core` releases and tell core (`v*`) and dashboard (`admin-v*`) tags apart — the archived `mx-server`/`mx-admin` repos are no longer consulted, so version banners are accurate again. The system info panel also resolves through the correct `/info` endpoint, restoring the server version display.

Dashboard resilience and editor polish round things out: when a deploy invalidates old JS chunks, the dashboard now detects the dynamic-import failure and reloads itself once instead of white-screening. The AI agent editor (via @haklex 0.21.1) keeps diff review cards inside their own conversation turn, renders diff hunks as nested rich content, and scopes the dark theme tokens correctly.

## Changes

### Features
- Project API: Zod-validated create/patch DTOs, new `PATCH /projects/:id` route, name-uniqueness conflicts surfaced as `PROJECT_NAME_TAKEN` (409), missing rows as `PROJECT_NOT_FOUND` (404). ([cc7a38d](https://github.com/mx-space/core/commit/cc7a38d438e9cc75b372857a16ee0eafd24a5b29))
- Admin dashboard auto-reloads once when a stale deployment makes dynamic chunks unloadable, instead of crashing. ([1d7c110](https://github.com/mx-space/core/commit/1d7c1105ccca2bedc31bc507cc3c536a6e34f1db))

### Bug Fixes
- Admin update checks now target `mx-space/core` and discriminate core vs dashboard release tags; system info resolves via `/info`, restoring the version display. ([8a269ea](https://github.com/mx-space/core/commit/8a269ea25c951136f3bf4536013594f272c1c451))
- AI agent diff review cards stay within their own conversation turn instead of leaking into adjacent ones. ([6dcff54](https://github.com/mx-space/core/commit/6dcff54029482ae5e85100257e48da8237aaaae0))

### Other
- @haklex editor packages bumped to 0.21.1: diff hunks render as nested rich content, occupied block ids stay resolvable during diff review, and dark theme variables no longer leak outside their scope. ([0fa60a8](https://github.com/mx-space/core/commit/0fa60a826971bd1198f9590d3ce252514229fbf8))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.7.0...v13.8.0
