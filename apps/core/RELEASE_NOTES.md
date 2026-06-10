## TL;DR

Cron jobs and AI tasks now share one unified task queue with a single admin view, alongside AI summary/translation fixes and a denser analyze page.

## Highlights

Background work is now managed in one place. Cron history and AI task views merge into a single tasks module backed by a shared task-queue processor, so every scheduled job and AI run shows up in the same list with duration and failure summaries. Old task URLs redirect to the new module, so existing bookmarks keep working. ([#2746](https://github.com/mx-space/core/pull/2746))

AI translation got more trustworthy. Block translations that come back identical to the source text are no longer cached and reused, and the "translate all" task now correctly enumerates the articles it should process instead of running on an empty list. Stored AI summaries also attach to the public response meta even when the content hash has drifted, so readers see summaries that previously went missing after edits.

The admin analyze page was redesigned as a dense single board: the metric strip fuses with the trend chart into a hero panel, sources and devices render as bar lists instead of donuts, and raw visit records move into a drawer for a much tighter overview.

## Changes

### Features

- Unified task queue: cron and AI tasks share one processor, one admin module, and one API, with legacy route redirects. ([#2746](https://github.com/mx-space/core/pull/2746))
- Analyze page redesigned as a dense single board with a hero trend panel, bar-list breakdowns, and a visit-records drawer. ([55450f1](https://github.com/mx-space/core/commit/55450f1d3))

### Bug Fixes

- Stored AI summaries now appear in the public response meta even when the article's content hash has changed since the summary was generated. ([17a511e](https://github.com/mx-space/core/commit/17a511e0c))
- AI translation no longer saves or reuses block translations that are identical to the source text. ([b4c8640](https://github.com/mx-space/core/commit/b4c864085))
- The "translate all" AI task now populates its article list correctly instead of processing nothing. ([240dae7](https://github.com/mx-space/core/commit/240dae739))

### Other

- Codebase-wide cleanup with hot-path efficiency gains: per-request session resolution is memoized (was resolved up to three times per request), search index rebuilds batch their writes, and subscriber fan-out no longer issues one query per subscriber. ([a11b9a8](https://github.com/mx-space/core/commit/a11b9a8a7))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.9.0...v13.10.0
