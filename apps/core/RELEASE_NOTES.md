## TL;DR

Mix Space 14.6 adds streaming batch article-body retrieval, improves premium previews, and ships more reliable inline-code editing.

## Highlights

Clients can now retrieve post and note bodies in batches through a persistence-friendly NDJSON stream. Each line preserves paywall, language, and unchanged-version information, allowing mobile and other consumers to hydrate local content efficiently without losing access-control semantics or downloading bodies that are already current.

Premium content previews no longer become blank when a record has no Lexical body. The bundled admin editor also adopts Haklex 0.38.0, placing the caret outside inline-code formatting at the boundary so authors can continue typing normal text without getting trapped in the code style.

## Changes

### Features

- Added a batch article-body endpoint that streams persistence-ready NDJSON for posts and notes ([c5bea4b](https://github.com/mx-space/core/commit/c5bea4bff0125787121c548d73f2165330815cb7)).

### Bug Fixes

- Premium articles now provide teaser content when their Lexical body is unavailable ([a3bb701](https://github.com/mx-space/core/commit/a3bb7016a89edc1b7bfeb6ed3f667da34278dffe)).
- Inline-code boundaries in the admin editor now place continued input outside the code mark ([de57bd7](https://github.com/mx-space/core/commit/de57bd73d8b29f47eaf74eab59aad3c912065047)).

### Other

- Updated the bundled Haklex editor packages to 0.38.0, including the public file-node key export ([de57bd7](https://github.com/mx-space/core/commit/de57bd73d8b29f47eaf74eab59aad3c912065047)).

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.5.1...v14.6.0
