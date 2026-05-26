## TL;DR

Article details now ship the AI summary inline, partial Lexical translations reuse unchanged blocks, and reader presence stays correct across clients.

## Highlights

Public article detail responses now embed the stored AI summary directly in `meta`, eliminating the extra `/ai/summaries/article/:id` call the frontend used to fan out. The lookup is strict per requested language and gracefully degrades to an empty meta field when no summary exists yet — never breaking the detail payload. Partial Lexical block translations ([#2737](https://github.com/mx-space/core/pull/2737)) take this further by reusing already-translated blocks when only part of an article changes, cutting AI cost and latency on edits.

Reader lists are now ordered by most recent session, surfacing currently-active visitors at the top of the admin view instead of relying on creation time. Presence updates normalize the identity field to lowercase across all client sources (Yohaku, admin, mobile), which prevents the same reader from appearing twice in `uniqBy` / `keyBy` aggregations when older clients send mixed-case identifiers.

Real-time article update payloads broadcast through the gateway are now localized per recipient session, so admin dashboards and frontends in different languages receive the right translated copy on every push notification instead of a single canonical language.

## Changes

### Features
- AI summary appears inline on public article detail `meta` (posts and notes), removing the extra summary fetch round-trip. ([d78967d](https://github.com/mx-space/core/commit/d78967d4d352fb3c0e1a861cd1f84b229dc20509))
- Lexical block translations reuse unchanged blocks across partial edits. ([#2737](https://github.com/mx-space/core/pull/2737))
- Reader list orders by most recent session. ([dc826bb](https://github.com/mx-space/core/commit/dc826bbe4d24521bab7be9425c70d94b832457f5))

### Bug Fixes
- Real-time article update payloads localize per recipient session. ([cd71e1a](https://github.com/mx-space/core/commit/cd71e1a613b540b898636b8420d2965dce1c59e9))
- Presence identity normalized to lowercase to prevent duplicate reader entries. ([3798d14](https://github.com/mx-space/core/commit/3798d14c06c7e5cc4514a4879ca55e1858af28e0))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.0.3...v13.1.0
