## TL;DR

Security hardening across outbound fetches and request handling, plus list endpoints that ship up to 100x smaller payloads by no longer fetching article bodies.

## Highlights

Hot read endpoints (`/timeline`, `/aggregate/top`, `/posts`, `/notes`, `/categories/:slug`, sitemap) now select only the columns their wire contracts actually expose. Article bodies (`text`/`content`) stay in the database instead of being fetched, serialized, and discarded. On a 600-article dataset the timeline response shrinks from ~32MB to ~400KB and category listings drop from ~19MB to ~190KB, with 3–7x lower query latency on cache misses. The category `?ids=` listing also stops leaking full Lexical content that was never part of its contract.

A security audit pass hardens the server's outbound and inbound edges: link-avatar, webhook, and markdown image fetches now go through a shared SSRF guard (timeouts, no redirects, CIDR-based private-range blocking with IPv4-in-IPv6 detection), rendered markdown HTML is sanitized, backup restore gains zip-slip protection, and search escapes SQL LIKE patterns. The comment spam filter switches to literal, ReDoS-safe keyword matching, and blocking Redis `keys()` scans are replaced with cursor-based scanning.

## Changes

### Bug Fixes

- Security audit: shared SSRF guard for all outbound fetches, sanitized markdown rendering, zip-slip protection in backup restore, SQL LIKE escaping in search, ReDoS-safe spam filter and marked extensions, and hardened trust-proxy IP resolution. ([915d0e3](https://github.com/mx-space/core/commit/915d0e320333231c62c7f13a5e089f4a3c70b80d))

### Performance Improvements

- List endpoints no longer fetch article bodies the response never includes; the post list pushes its `truncate` parameter into SQL and the note list backfills bodies only for notes missing a stored AI summary. Payloads shrink 59–102x on body-heavy datasets. ([64cb110](https://github.com/mx-space/core/commit/64cb110ab844f06f471a40125e3e54f8290753cc))

## Upgrade Notes

API keys are no longer accepted via the query string. Clients must send the key in the `x-api-key` header instead of `?apiKey=` / `?api_key=` parameters.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.10.1...v13.10.2
